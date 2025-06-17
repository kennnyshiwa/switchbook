import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MasterSwitchStatus } from '@prisma/client'
import { z } from 'zod'

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

    // Check if submission exists and is pending
    const submission = await prisma.masterSwitch.findUnique({
      where: { id },
      select: {
        status: true,
        name: true,
        manufacturer: true,
        submittedBy: {
          select: {
            email: true,
            username: true
          }
        }
      }
    })

    if (!submission) {
      return NextResponse.json(
        { error: 'Submission not found' },
        { status: 404 }
      )
    }

    if (submission.status !== MasterSwitchStatus.PENDING) {
      return NextResponse.json(
        { error: 'Submission is not pending' },
        { status: 400 }
      )
    }

    // Update submission status
    const updatedSubmission = await prisma.masterSwitch.update({
      where: { id },
      data: {
        status: MasterSwitchStatus.REJECTED,
        rejectionReason: reason,
        approvedById: session.user.id,
        approvedAt: new Date(),
      }
    })

    // TODO: Send email notification to submitter about rejection with reason

    return NextResponse.json({
      message: 'Submission rejected',
      submission: updatedSubmission
    })

  } catch (error) {
    console.error('Error rejecting submission:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to reject submission' },
      { status: 500 }
    )
  }
}