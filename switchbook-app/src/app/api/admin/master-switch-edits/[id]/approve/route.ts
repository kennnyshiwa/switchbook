import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { sendEditSuggestionApprovalEmail } from '@/lib/email'

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

    // Get the edit suggestion
    const editSuggestion = await prisma.masterSwitchEdit.findUnique({
      where: { id },
      include: {
        masterSwitch: true,
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

    // Apply the edit to the master switch
    const newData = editSuggestion.newData as any
    
    // Extract fields that should be updated
    const updateData: any = {}
    const fieldsToUpdate = [
      'name', 'chineseName', 'manufacturer', 'type', 'technology',
      'compatibility', 'actuationForce', 'tactileForce', 'tactilePosition',
      'bottomOutForce', 'preTravel', 'notes', 'imageUrl', 'topHousing', 
      'bottomHousing', 'stem', 'springWeight', 'springLength', 'bottomOut', 
      'magnetOrientation', 'magnetPosition', 'magnetPolarity', 'initialForce', 
      'initialMagneticFlux', 'bottomOutMagneticFlux', 'pcbThickness', 
      'frankenTop', 'frankenBottom', 'frankenStem', 'clickType',
      'progressiveSpring', 'doubleStage', 'topHousingColor', 'bottomHousingColor',
      'stemColor', 'stemShape', 'markings'
    ]

    for (const field of fieldsToUpdate) {
      if (field in newData && newData[field] !== undefined) {
        updateData[field] = newData[field]
      }
    }

    // Update the master switch and increment version
    const updatedMasterSwitch = await prisma.masterSwitch.update({
      where: { id: editSuggestion.masterSwitchId },
      data: {
        ...updateData,
        version: { increment: 1 },
        lastModifiedAt: new Date()
      }
    })

    // Clear any dismissed notifications for this type since there's a new update
    await prisma.dismissedNotification.deleteMany({
      where: {
        type: 'MASTER_UPDATES',
        lastMasterUpdateVersion: {
          lt: updatedMasterSwitch.version
        }
      }
    })

    // Update the edit suggestion status
    await prisma.masterSwitchEdit.update({
      where: { id },
      data: {
        status: 'APPROVED',
        approvedById: session.user.id
      }
    })

    // Create notification for the editor
    await prisma.notification.create({
      data: {
        userId: editSuggestion.editedById,
        type: 'EDIT_APPROVED',
        title: 'Edit Suggestion Approved!',
        message: `Your edit suggestion for "${editSuggestion.masterSwitch.name}" has been approved.`,
        link: `/switches/${editSuggestion.masterSwitchId}/history`,
        linkText: 'View History'
      }
    })

    // Send email notification
    await sendEditSuggestionApprovalEmail(
      editSuggestion.editedBy.email,
      editSuggestion.masterSwitch.name,
      editSuggestion.masterSwitchId
    )

    return NextResponse.json({
      message: 'Edit suggestion approved and applied successfully'
    })

  } catch (error) {
    console.error('Error approving edit suggestion:', error)
    return NextResponse.json(
      { error: 'Failed to approve edit suggestion' },
      { status: 500 }
    )
  }
}