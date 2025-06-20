import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { validateImageUrl } from '@/lib/image-security'
import { IMAGE_CONFIG } from '@/lib/image-config'

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
      },
      include: {
        images: true
      }
    })

    if (!switchItem) {
      return NextResponse.json({ error: 'Switch not found' }, { status: 404 })
    }

    // Check image count limit
    if (switchItem.images.length >= IMAGE_CONFIG.maxImagesPerSwitch) {
      return NextResponse.json(
        { error: `Maximum ${IMAGE_CONFIG.maxImagesPerSwitch} images allowed per switch` },
        { status: 400 }
      )
    }

    // Parse request body
    const body = await request.json()
    const { url, caption } = body

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    // Validate URL
    const urlValidation = validateImageUrl(url)
    if (!urlValidation.valid) {
      return NextResponse.json(
        { error: urlValidation.error || 'Invalid image URL' },
        { status: 400 }
      )
    }

    // Get the next order number
    const maxOrder = switchItem.images.length > 0
      ? Math.max(...switchItem.images.map(img => img.order))
      : -1

    // Create database record for linked image
    const image = await prisma.switchImage.create({
      data: {
        switchId: id,
        url,
        type: 'LINKED',
        order: maxOrder + 1,
        caption: caption || null,
        // We don't have dimensions for linked images
        width: null,
        height: null,
        size: null
      }
    })

    // If this is the first image, set it as primary
    if (switchItem.images.length === 0) {
      await prisma.switch.update({
        where: { id },
        data: { primaryImageId: image.id }
      })
    }

    return NextResponse.json(image)
  } catch (error) {
    console.error('Failed to add linked image:', error)
    return NextResponse.json({ error: 'Failed to add linked image' }, { status: 500 })
  }
}