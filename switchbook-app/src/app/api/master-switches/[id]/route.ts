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

    // Track unique view - only increment if user hasn't viewed before
    const existingView = await prisma.masterSwitchView.findUnique({
      where: {
        masterSwitchId_userId: {
          masterSwitchId: id,
          userId: session.user.id
        }
      }
    })

    if (!existingView) {
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

    return NextResponse.json({
      ...masterSwitch,
      inCollection: !!userSwitch,
      userSwitchId: userSwitch?.id,
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