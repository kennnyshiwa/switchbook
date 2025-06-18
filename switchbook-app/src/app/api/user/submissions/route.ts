import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch master switch submissions
    const submissions = await prisma.masterSwitch.findMany({
      where: {
        submittedById: session.user.id
      },
      select: {
        id: true,
        name: true,
        manufacturer: true,
        type: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        approvedAt: true,
        approvedBy: {
          select: {
            username: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    })

    // Fetch edit suggestions
    const editSuggestions = await prisma.masterSwitchEdit.findMany({
      where: {
        editedById: session.user.id
      },
      select: {
        id: true,
        masterSwitch: {
          select: {
            id: true,
            name: true,
            manufacturer: true
          }
        },
        status: true,
        rejectionReason: true,
        editedAt: true,
        approvedBy: {
          select: {
            username: true
          }
        },
        changedFields: true
      },
      orderBy: {
        editedAt: 'desc'
      }
    })

    return NextResponse.json({
      submissions,
      editSuggestions
    })
  } catch (error) {
    console.error('Error fetching user submissions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch submissions' },
      { status: 500 }
    )
  }
}