import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

const dismissSchema = z.object({
  type: z.string(),
  lastMasterUpdateVersion: z.number().optional()
})

export async function POST(req: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { type, lastMasterUpdateVersion } = dismissSchema.parse(body)

    // Upsert the dismissed notification
    await prisma.dismissedNotification.upsert({
      where: {
        userId_type: {
          userId: session.user.id,
          type
        }
      },
      update: {
        dismissedAt: new Date(),
        lastMasterUpdateVersion
      },
      create: {
        userId: session.user.id,
        type,
        lastMasterUpdateVersion
      }
    })

    return NextResponse.json({
      message: 'Notification dismissed successfully'
    })

  } catch (error) {
    console.error('Error dismissing notification:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }
    
    return NextResponse.json(
      { error: 'Failed to dismiss notification' },
      { status: 500 }
    )
  }
}