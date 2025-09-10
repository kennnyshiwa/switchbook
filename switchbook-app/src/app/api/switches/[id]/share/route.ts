import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { nanoid } from 'nanoid'

interface RouteParams {
  params: Promise<{ id: string }>
}

// POST - Generate or regenerate a share link for a switch
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify the switch belongs to the user
    const switchItem = await prisma.switch.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!switchItem) {
      return NextResponse.json(
        { error: 'Switch not found' },
        { status: 404 }
      )
    }

    // Generate a new shareable ID (overwrites existing one if present)
    const shareableId = nanoid(10)

    // Update the switch with the new shareable ID
    const updatedSwitch = await prisma.switch.update({
      where: { id },
      data: { shareableId },
      select: {
        id: true,
        name: true,
        shareableId: true,
      }
    })

    // Return the share URL
    const shareUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/share/user-switch/${shareableId}`

    return NextResponse.json({
      shareableId: updatedSwitch.shareableId,
      shareUrl,
      message: 'Share link generated successfully'
    })
  } catch (error) {
    console.error('Error generating share link:', error)
    return NextResponse.json(
      { error: 'Failed to generate share link' },
      { status: 500 }
    )
  }
}

// DELETE - Remove the share link for a switch
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify the switch belongs to the user
    const switchItem = await prisma.switch.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
    })

    if (!switchItem) {
      return NextResponse.json(
        { error: 'Switch not found' },
        { status: 404 }
      )
    }

    // Remove the shareable ID
    await prisma.switch.update({
      where: { id },
      data: { shareableId: null },
    })

    return NextResponse.json({
      message: 'Share link removed successfully'
    })
  } catch (error) {
    console.error('Error removing share link:', error)
    return NextResponse.json(
      { error: 'Failed to remove share link' },
      { status: 500 }
    )
  }
}

// GET - Get the current share status of a switch
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Get the switch and verify ownership
    const switchItem = await prisma.switch.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: {
        id: true,
        name: true,
        shareableId: true,
      }
    })

    if (!switchItem) {
      return NextResponse.json(
        { error: 'Switch not found' },
        { status: 404 }
      )
    }

    if (switchItem.shareableId) {
      const shareUrl = `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/share/user-switch/${switchItem.shareableId}`
      
      return NextResponse.json({
        isShared: true,
        shareableId: switchItem.shareableId,
        shareUrl,
      })
    }

    return NextResponse.json({
      isShared: false,
      shareableId: null,
      shareUrl: null,
    })
  } catch (error) {
    console.error('Error getting share status:', error)
    return NextResponse.json(
      { error: 'Failed to get share status' },
      { status: 500 }
    )
  }
}