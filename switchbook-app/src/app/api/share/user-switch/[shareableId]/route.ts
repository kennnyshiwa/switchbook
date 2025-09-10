import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: Promise<{ shareableId: string }>
}

// GET - Fetch a shared individual switch
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { shareableId } = await params

    // Get the switch with all its relations
    const switchItem = await prisma.switch.findUnique({
      where: { shareableId },
      include: {
        user: {
          select: {
            username: true,
            id: true
          }
        },
        images: {
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!switchItem) {
      return NextResponse.json(
        { error: 'Switch not found' },
        { status: 404 }
      )
    }

    // Return the switch data
    return NextResponse.json(switchItem)
  } catch (error) {
    console.error('Error fetching shared switch:', error)
    return NextResponse.json(
      { error: 'Failed to fetch switch' },
      { status: 500 }
    )
  }
}