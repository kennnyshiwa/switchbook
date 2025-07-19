import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const materials = await prisma.material.findMany({
      where: { active: true },
      orderBy: [
        { order: 'asc' },
        { name: 'asc' }
      ]
    })

    return NextResponse.json(materials)
  } catch (error) {
    console.error('Failed to fetch materials:', error)
    return NextResponse.json(
      { error: 'Failed to fetch materials' },
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
        { error: 'Material name is required' },
        { status: 400 }
      )
    }

    // Check if material already exists
    const existing = await prisma.material.findUnique({
      where: { name }
    })

    if (existing) {
      return NextResponse.json(
        { error: 'Material already exists' },
        { status: 400 }
      )
    }

    // Get the highest order value
    const maxOrder = await prisma.material.findFirst({
      orderBy: { order: 'desc' },
      select: { order: true }
    })

    const material = await prisma.material.create({
      data: {
        name,
        order: (maxOrder?.order ?? 0) + 1
      }
    })

    return NextResponse.json(material, { status: 201 })
  } catch (error) {
    console.error('Failed to create material:', error)
    return NextResponse.json(
      { error: 'Failed to create material' },
      { status: 500 }
    )
  }
}