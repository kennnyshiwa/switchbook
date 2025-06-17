import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MasterSwitchStatus } from '@prisma/client'

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
        status: MasterSwitchStatus.APPROVED,
        approvedById: session.user.id,
        approvedAt: new Date(),
        version: 1,
      }
    })

    // TODO: Send email notification to submitter about approval

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