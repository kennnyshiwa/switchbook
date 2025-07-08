import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(
  request: NextRequest,
  { params }: { params: { shareableId: string } }
) {
  try {
    const { shareableId } = params

    if (!shareableId) {
      return NextResponse.json(
        { error: 'Shareable ID is required' },
        { status: 400 }
      )
    }

    // Find the master switch by shareableId
    const masterSwitch = await prisma.masterSwitch.findFirst({
      where: { 
        shareableId,
        // Only show approved switches
        status: 'APPROVED'
      },
      include: {
        submittedBy: {
          select: {
            id: true,
            username: true
          }
        },
        images: true
      }
    })

    if (!masterSwitch) {
      return NextResponse.json(
        { error: 'Switch not found' },
        { status: 404 }
      )
    }

    // Increment view count (non-blocking)
    prisma.masterSwitch.update({
      where: { id: masterSwitch.id },
      data: { viewCount: { increment: 1 } }
    }).catch(err => console.error('Failed to increment view count:', err))

    return NextResponse.json(masterSwitch)
  } catch (error) {
    console.error('Error fetching shared master switch:', error)
    return NextResponse.json(
      { error: 'Failed to fetch switch' },
      { status: 500 }
    )
  }
}