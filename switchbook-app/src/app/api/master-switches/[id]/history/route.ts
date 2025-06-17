import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Fetch the master switch with all its edit history
    const masterSwitch = await prisma.masterSwitch.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        manufacturer: true,
        edits: {
          orderBy: {
            editedAt: 'desc'
          },
          select: {
            id: true,
            editedAt: true,
            editedBy: {
              select: {
                id: true,
                username: true
              }
            },
            approvedBy: {
              select: {
                id: true,
                username: true
              }
            },
            status: true,
            changedFields: true,
            previousData: true,
            newData: true,
            rejectionReason: true
          }
        }
      }
    })

    if (!masterSwitch) {
      return NextResponse.json(
        { error: 'Master switch not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(masterSwitch)

  } catch (error) {
    console.error('Error fetching edit history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch edit history' },
      { status: 500 }
    )
  }
}