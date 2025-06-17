import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const dismissedNotifications = await prisma.dismissedNotification.findMany({
      where: {
        userId: session.user.id
      },
      select: {
        type: true,
        dismissedAt: true,
        lastMasterUpdateVersion: true
      }
    })

    return NextResponse.json(dismissedNotifications)

  } catch (error) {
    console.error('Error fetching dismissed notifications:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dismissed notifications' },
      { status: 500 }
    )
  }
}