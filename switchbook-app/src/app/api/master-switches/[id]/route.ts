import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { MasterSwitchStatus } from '@prisma/client'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const masterSwitch = await prisma.masterSwitch.findFirst({
      where: {
        id: params.id,
        status: MasterSwitchStatus.APPROVED
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

    // Increment view count
    await prisma.masterSwitch.update({
      where: { id: params.id },
      data: { viewCount: { increment: 1 } }
    })

    // Check if user has this in their collection
    const userSwitch = await prisma.switch.findFirst({
      where: {
        userId: session.user.id,
        masterSwitchId: params.id
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