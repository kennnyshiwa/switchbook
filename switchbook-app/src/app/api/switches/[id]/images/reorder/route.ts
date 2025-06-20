import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { reorderImagesSchema } from '@/lib/validation'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify switch ownership
    const switchItem = await prisma.switch.findFirst({
      where: {
        id,
        userId: session.user.id
      }
    })

    if (!switchItem) {
      return NextResponse.json({ error: 'Switch not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const { images } = reorderImagesSchema.parse(body)

    // Verify all image IDs belong to this switch
    const imageIds = images.map(img => img.id)
    const existingImages = await prisma.switchImage.findMany({
      where: {
        id: { in: imageIds },
        switchId: id
      }
    })

    if (existingImages.length !== images.length) {
      return NextResponse.json({ error: 'Invalid image IDs' }, { status: 400 })
    }

    // Update order for each image
    await Promise.all(
      images.map(({ id, order }) =>
        prisma.switchImage.update({
          where: { id },
          data: { order }
        })
      )
    )

    // Fetch and return updated images
    const updatedImages = await prisma.switchImage.findMany({
      where: { switchId: id },
      orderBy: { order: 'asc' }
    })

    return NextResponse.json(updatedImages)
  } catch (error) {
    console.error('Failed to reorder images:', error)
    return NextResponse.json({ error: 'Failed to reorder images' }, { status: 500 })
  }
}