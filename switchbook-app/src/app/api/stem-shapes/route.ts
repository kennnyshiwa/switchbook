import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const stemShapes = await prisma.stemShape.findMany({
      where: { active: true },
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(stemShapes)
  } catch (error) {
    console.error('Failed to fetch stem shapes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch stem shapes' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    
    if (!session || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { name } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Stem shape name is required' },
        { status: 400 }
      )
    }

    // Check if stem shape already exists
    const existing = await prisma.stemShape.findUnique({
      where: { name }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Stem shape already exists' },
        { status: 400 }
      )
    }

    // Get the highest order value
    const maxOrder = await prisma.stemShape.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true }
    })

    const stemShape = await prisma.stemShape.create({
      data: {
        name,
        order: (maxOrder?.order ?? 0) + 1
      }
    })

    return NextResponse.json(stemShape, { status: 201 })
  } catch (error) {
    console.error('Failed to create stem shape:', error)
    return NextResponse.json(
      { error: 'Failed to create stem shape' },
      { status: 500 }
    )
  }
}