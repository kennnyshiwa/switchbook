import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { imageUploadSchema } from '@/lib/validation'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, imageId } = await params

    // Verify ownership
    const image = await prisma.switchImage.findFirst({
      where: {
        id: imageId,
        switch: {
          id,
          userId: session.user.id
        }
      }
    })

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = imageUploadSchema.parse(body)

    // Update image
    const updatedImage = await prisma.switchImage.update({
      where: { id: imageId },
      data: {
        caption: validatedData.caption !== undefined ? validatedData.caption : image.caption,
        order: validatedData.order !== undefined ? validatedData.order : image.order
      }
    })

    return NextResponse.json(updatedImage)
  } catch (error) {
    console.error('Failed to update image:', error)
    return NextResponse.json({ error: 'Failed to update image' }, { status: 500 })
  }
}