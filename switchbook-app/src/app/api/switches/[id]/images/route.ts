import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { put, del } from '@vercel/blob'
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
    let fileExtension = getFileExtension(file.name)
    if (file.type === 'image/heic' || file.type === 'image/heif') {
      processedBuffer = await convertHeicToJpeg(buffer)
      fileExtension = 'jpg'
    }

    // Create image variants
    const variants = await createImageVariants(processedBuffer)

    // Generate unique image ID
    const imageId = crypto.randomUUID()

    // Upload to Vercel Blob
    const uploadPromises = [
      // Upload thumbnail
      put(
        getImagePath(session.user.id, id, imageId, 'thumb', 'jpg'),
        variants.thumbnail,
        { 
          access: 'public',
          contentType: 'image/jpeg'
        }
      ),
      // Upload medium size
      put(
        getImagePath(session.user.id, id, imageId, 'medium', 'jpg'),
        variants.medium,
        { 
          access: 'public',
          contentType: 'image/jpeg'
        }
      ),
      // Upload original
      put(
        getImagePath(session.user.id, id, imageId, 'original', fileExtension),
        variants.original,
        { 
          access: 'public',
          contentType: file.type === 'image/heic' || file.type === 'image/heif' ? 'image/jpeg' : file.type
        }
      )
    ]

    const [thumbBlob, mediumBlob, originalBlob] = await Promise.all(uploadPromises)

    // Get the next order number
    const maxOrder = switchItem.images.length > 0
      ? Math.max(...switchItem.images.map(img => img.order))
      : -1

    // Create database record
    const image = await prisma.switchImage.create({
      data: {
        switchId: id,
        url: originalBlob.url,
        type: 'UPLOADED',
        order: maxOrder + 1,
        caption: caption || null,
        width: validation.metadata?.width,
        height: validation.metadata?.height,
        size: variants.original.length
      }
    })

    // If this is the first image, set it as primary
    if (switchItem.images.length === 0) {
      await prisma.switch.update({
        where: { id },
        data: { primaryImageId: image.id }
      })
    }

    return NextResponse.json({
      ...image,
      thumbnailUrl: thumbBlob.url,
      mediumUrl: mediumBlob.url
    })
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

    // Verify ownership
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

    // Delete from Vercel Blob (only for uploaded images)
    if (image.type === 'UPLOADED') {
      try {
        // Extract the path from the URL to delete all variants
        const urlParts = new URL(image.url).pathname.split('/')
        const fileName = urlParts[urlParts.length - 1]
        const baseImageId = fileName.split('.')[0].replace(/-original$/, '')
        
        await Promise.all([
          del(image.url).catch(() => {}), // Original
          del(image.url.replace(`${baseImageId}.`, `${baseImageId}-thumb.`)).catch(() => {}), // Thumbnail
          del(image.url.replace(`${baseImageId}.`, `${baseImageId}-medium.`)).catch(() => {}) // Medium
        ])
      } catch (error) {
        console.error('Failed to delete from blob storage:', error)
        // Continue with database deletion even if blob deletion fails
      }
    }

    // Delete from database
    await prisma.switchImage.delete({
      where: { id: imageId }
    })

    // If this was the primary image, update to the next available image
    if (image.switch?.primaryImageId === imageId) {
      const nextImage = await prisma.switchImage.findFirst({
        where: {
          switchId: id,
          id: { not: imageId }
        },
        orderBy: { order: 'asc' }
      })

      await prisma.switch.update({
        where: { id },
        data: { primaryImageId: nextImage?.id || null }
      })
    }

    // Reorder remaining images
    const remainingImages = await prisma.switchImage.findMany({
      where: { switchId: id },
      orderBy: { order: 'asc' }
    })

    await Promise.all(
      remainingImages.map((img, index) =>
        prisma.switchImage.update({
          where: { id: img.id },
          data: { order: index }
        })
      )
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete image:', error)
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
  }
}