import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MasterSwitchStatus } from '@prisma/client'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    
    const masterSwitch = await prisma.masterSwitch.findFirst({
      where: {
        id: id,
        OR: [
          { status: MasterSwitchStatus.APPROVED },
          { 
            status: MasterSwitchStatus.PENDING,
            submittedById: session.user.id 
          }
        ]
      },
      include: {
        submittedBy: {
          select: {
            id: true,
            username: true,
          }
        },
        approvedBy: {
          select: {
            id: true,
            username: true,
          }
        },
        _count: {
          select: {
            userSwitches: true
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

    // Track view - only increment if last view was more than 30 seconds ago
    const thirtySecondsAgo = new Date(Date.now() - 30 * 1000)
    
    const recentView = await prisma.masterSwitchView.findFirst({
      where: {
        masterSwitchId: id,
        userId: session.user.id,
        viewedAt: {
          gte: thirtySecondsAgo
        }
      },
      orderBy: {
        viewedAt: 'desc'
      }
    })

    if (!recentView) {
      // Create view record and increment count in a transaction
      await prisma.$transaction([
        prisma.masterSwitchView.create({
          data: {
            masterSwitchId: id,
            userId: session.user.id
          }
        }),
        prisma.masterSwitch.update({
          where: { id: id },
          data: { viewCount: { increment: 1 } }
        })
      ])
    }

    // Check if user has this in their collection
    const userSwitch = await prisma.switch.findFirst({
      where: {
        userId: session.user.id,
        masterSwitchId: id
      }
    })

    // Check if user has this in their wishlist
    const wishlistItem = await prisma.wishlist.findFirst({
      where: {
        userId: session.user.id,
        masterSwitchId: id
      }
    })

    return NextResponse.json({
      ...masterSwitch,
      inCollection: !!userSwitch,
      userSwitchId: userSwitch?.id,
      inWishlist: !!wishlistItem,
      wishlistId: wishlistItem?.id,
      userCount: masterSwitch._count.userSwitches
    })
  } catch (error) {
    console.error('Error fetching master switch:', error)
    return NextResponse.json(
      { error: 'Failed to fetch master switch' },
      { status: 500 }
    )
  }
}