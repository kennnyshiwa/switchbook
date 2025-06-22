import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get switch submissions
    const switchSubmissions = await prisma.masterSwitch.findMany({
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

    // Get edit suggestions
    const editSuggestions = await prisma.masterSwitchEdit.findMany({
      where: {
        editedById: session.user.id
      },
      select: {
        id: true,
        status: true,
        rejectionReason: true,
        editedAt: true,
        masterSwitch: {
          select: {
            id: true,
            name: true,
            manufacturer: true,
            type: true
          }
        },
        approvedBy: {
          select: {
            username: true
          }
        }
      },
      orderBy: {
        editedAt: 'desc'
      }
    })

    return NextResponse.json({
      switchSubmissions,
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