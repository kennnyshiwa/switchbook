import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { name, aliases, verified } = body

    const updated = await prisma.manufacturer.update({
      where: { id },
      data: {
        name,
        aliases,
        verified
      }
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('Failed to update manufacturer:', error)
    return NextResponse.json(
      { error: "Failed to update manufacturer" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth()
    
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const { id } = await params

    // Check if manufacturer is in use
    const usageCount = await prisma.switch.count({
      where: {
        manufacturer: {
          in: await prisma.manufacturer.findUnique({
            where: { id },
            select: { name: true }
          }).then(m => [m?.name || ''])
        }
      }
    })

    if (usageCount > 0) {
      return NextResponse.json(
        { error: "Cannot delete manufacturer that is in use" },
        { status: 400 }
      )
    }

    await prisma.manufacturer.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete manufacturer:', error)
    return NextResponse.json(
      { error: "Failed to delete manufacturer" },
      { status: 500 }
    )
  }
}