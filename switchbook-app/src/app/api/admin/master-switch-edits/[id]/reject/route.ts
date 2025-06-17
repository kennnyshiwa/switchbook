import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { sendEditSuggestionRejectionEmail } from '@/lib/email'

const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required')
})

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { reason } = rejectSchema.parse(body)

    // Get the edit suggestion
    const editSuggestion = await prisma.masterSwitchEdit.findUnique({
      where: { id },
      include: {
        masterSwitch: {
          select: {
            id: true,
            name: true
          }
        },
        editedBy: {
          select: {
            email: true
          }
        }
      }
    })

    if (!editSuggestion) {
      return NextResponse.json(
        { error: 'Edit suggestion not found' },
        { status: 404 }
      )
    }

    if (editSuggestion.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Edit suggestion is not pending' },
        { status: 400 }
      )
    }

    // Update the edit suggestion status
    await prisma.masterSwitchEdit.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        approvedById: session.user.id
      }
    })

    // Create notification for the editor
    await prisma.notification.create({
      data: {
        userId: editSuggestion.editedById,
        type: 'EDIT_REJECTED',
        title: 'Edit Suggestion Rejected',
        message: `Your edit suggestion for "${editSuggestion.masterSwitch.name}" was not approved. Reason: ${reason}`,
        link: `/switches/${editSuggestion.masterSwitchId}`,
        linkText: 'View Switch'
      }
    })

    // Send email notification
    await sendEditSuggestionRejectionEmail(
      editSuggestion.editedBy.email,
      editSuggestion.masterSwitch.name,
      editSuggestion.masterSwitch.id,
      reason
    )

    return NextResponse.json({
      message: 'Edit suggestion rejected'
    })

  } catch (error) {
    console.error('Error rejecting edit suggestion:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to reject edit suggestion' },
      { status: 500 }
    )
  }
}