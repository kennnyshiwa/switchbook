import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadFile, deleteFile } from '@/lib/local-storage'
import { 
  IMAGE_CONFIG, 
  getImagePath, 
  isValidImageType, 
  isValidFileSize,
  getFileExtension,
  isValidExtension
} from '@/lib/image-config'
import { 
  validateAndProcessImage, 
  createImageVariants,
  convertHeicToJpeg,
  generateSafeFilename
} from '@/lib/image-utils'
import { checkRateLimit } from '@/lib/rate-limit'
import { imageUploadSchema } from '@/lib/validation'
import crypto from 'crypto'

export async function GET(
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
        images: {
          orderBy: { order: 'asc' }
        }
      }
    })

    if (!switchItem) {
      return NextResponse.json({ error: 'Switch not found' }, { status: 404 })
    }

    return NextResponse.json(switchItem.images)
  } catch (error) {
    console.error('Failed to fetch images:', error)
    return NextResponse.json({ error: 'Failed to fetch images' }, { status: 500 })
  }
}

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

    // Check rate limit
    const rateLimit = checkRateLimit(session.user.id)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: 'Too many uploads. Please try again later.',
          retryAfter: rateLimit.resetTime
        },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(IMAGE_CONFIG.rateLimits.maxUploadsPerMinute),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetTime)
          }
        }
      )
    }

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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const caption = formData.get('caption') as string | null
    
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type and extension
    if (!isValidImageType(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed types: JPEG, PNG, WebP, HEIC' },
        { status: 400 }
      )
    }

    if (!isValidExtension(file.name)) {
      return NextResponse.json(
        { error: 'Invalid file extension' },
        { status: 400 }
      )
    }

    // Validate file size
    if (!isValidFileSize(file.size)) {
      return NextResponse.json(
        { error: `File size must not exceed ${IMAGE_CONFIG.maxFileSize / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    // Check user's total storage
    const userStorage = await prisma.switchImage.aggregate({
      where: {
        switch: {
          userId: session.user.id
        }
      },
      _sum: {
        size: true
      }
    })

    const currentStorage = userStorage._sum.size || 0
    if (currentStorage + file.size > IMAGE_CONFIG.maxTotalStoragePerUser) {
      return NextResponse.json(
        { error: 'Storage limit exceeded. Please delete some images.' },
        { status: 400 }
      )
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer()
    const uint8Array = new Uint8Array(arrayBuffer)
    const buffer: Buffer = Buffer.from(uint8Array)

    // Validate and get image metadata
    const validation = await validateAndProcessImage(buffer, file.type)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid image' },
        { status: 400 }
      )
    }

    // Convert HEIC/HEIF to JPEG if needed
    let processedBuffer: Buffer = buffer
    let processedFile = file
    if (file.type === 'image/heic' || file.type === 'image/heif') {
      processedBuffer = await convertHeicToJpeg(buffer)
      // Create a new File from the converted buffer using ArrayBuffer
      const arrayBuffer = processedBuffer.buffer.slice(
        processedBuffer.byteOffset,
        processedBuffer.byteOffset + processedBuffer.byteLength
      ) as ArrayBuffer
      processedFile = new File([arrayBuffer], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg'
      })
    }

    // Generate unique image ID
    const imageId = crypto.randomUUID()
    const folder = `switches/${id}`

    // Upload to local storage
    const { url, pathname } = await uploadFile(processedFile, folder)

    // Get the next order number
    const maxOrder = switchItem.images.length > 0
      ? Math.max(...switchItem.images.map(img => img.order))
      : -1

    // Create database record
    const image = await prisma.switchImage.create({
      data: {
        switchId: id,
        url: url,
        type: 'UPLOADED',
        order: maxOrder + 1,
        caption: caption || null,
        width: validation.metadata?.width,
        height: validation.metadata?.height,
        size: processedFile.size
      }
    })

    // If this is the first image, set it as primary
    if (switchItem.images.length === 0) {
      await prisma.switch.update({
        where: { id },
        data: { imageUrl: url }
      })
    }

    return NextResponse.json(image)
  } catch (error) {
    console.error('Failed to upload image:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')

    if (!imageId) {
      return NextResponse.json({ error: 'Image ID required' }, { status: 400 })
    }

    // Verify image ownership
    const image = await prisma.switchImage.findFirst({
      where: {
        id: imageId,
        switch: {
          id,
          userId: session.user.id
        }
      },
      include: {
        switch: true
      }
    })

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Delete from local storage
    try {
      // Extract pathname from URL
      const pathname = image.url.replace('/uploads/', '')
      await deleteFile(pathname)
    } catch (error) {
      console.error('Failed to delete file from storage:', error)
      // Continue with database deletion even if file deletion fails
    }

    // Delete from database
    await prisma.switchImage.delete({
      where: { id: imageId }
    })

    // If this was the primary image, clear it
    if (image.switch && image.switch.imageUrl === image.url) {
      const remainingImages = await prisma.switchImage.findMany({
        where: { switchId: id },
        orderBy: { order: 'asc' },
        take: 1
      })

      await prisma.switch.update({
        where: { id },
        data: { 
          imageUrl: remainingImages[0]?.url || null 
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete image:', error)
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
  }
}