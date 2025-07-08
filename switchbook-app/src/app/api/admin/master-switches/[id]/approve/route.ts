import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MasterSwitchStatus } from '@prisma/client'
import { sendMasterSwitchApprovalEmail } from '@/lib/email'
import { nanoid } from 'nanoid'

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

    // Check if submission exists and is pending
    const submission = await prisma.masterSwitch.findUnique({
      where: { id },
      select: {
        status: true,
        name: true,
        manufacturer: true,
        submittedById: true,
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

    // Generate a shareable ID for the approved switch
    const shareableId = nanoid(10)

    // Update submission status
    const updatedSubmission = await prisma.masterSwitch.update({
      where: { id },
      data: {
        status: MasterSwitchStatus.APPROVED,
        approvedById: session.user.id,
        approvedAt: new Date(),
        version: 1,
        shareableId,
      }
    })

    // Create notification for submitter
    await prisma.notification.create({
      data: {
        userId: submission.submittedById,
        type: 'SUBMISSION_APPROVED',
        title: 'Master Switch Approved!',
        message: `Your submission for "${submission.name}" has been approved and is now live in the master database.`,
        link: `/switches/${id}`,
        linkText: 'View Switch'
      }
    })

    // Send email notification to submitter about approval
    await sendMasterSwitchApprovalEmail(
      submission.submittedBy.email,
      submission.name,
      id
    )

    return NextResponse.json({
      message: 'Submission approved successfully',
      submission: updatedSubmission
    })

  } catch (error) {
    console.error('Error approving submission:', error)
    return NextResponse.json(
      { error: 'Failed to approve submission' },
      { status: 500 }
    )
  }
}