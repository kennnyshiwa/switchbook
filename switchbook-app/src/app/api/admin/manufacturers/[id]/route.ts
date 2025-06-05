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
    const { searchParams } = new URL(request.url)
    const force = searchParams.get('force') === 'true'

    // Get manufacturer details
    const manufacturer = await prisma.manufacturer.findUnique({
      where: { id },
      select: { name: true, aliases: true }
    })

    if (!manufacturer) {
      return NextResponse.json(
        { error: "Manufacturer not found" },
        { status: 404 }
      )
    }

    // Check usage count
    const usageCount = await prisma.switch.count({
      where: {
        manufacturer: {
          equals: manufacturer.name,
          mode: 'insensitive'
        }
      }
    })

    // If manufacturer is in use and force is not specified, reject
    if (usageCount > 0 && !force) {
      return NextResponse.json(
        { error: "Cannot delete manufacturer that is in use", usageCount },
        { status: 400 }
      )
    }

    // If force delete, update all switches to have null manufacturer
    if (force && usageCount > 0) {
      await prisma.switch.updateMany({
        where: {
          manufacturer: {
            equals: manufacturer.name,
            mode: 'insensitive'
          }
        },
        data: {
          manufacturer: null
        }
      })
    }

    // Delete the manufacturer
    await prisma.manufacturer.delete({
      where: { id }
    })

    return NextResponse.json({ 
      success: true, 
      switchesUpdated: force ? usageCount : 0 
    })
  } catch (error) {
    console.error('Failed to delete manufacturer:', error)
    return NextResponse.json(
      { error: "Failed to delete manufacturer" },
      { status: 500 }
    )
  }
}