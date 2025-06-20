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
  convertHeicToJpeg
} from '@/lib/image-utils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify master switch exists
    const masterSwitch = await prisma.masterSwitch.findUnique({
      where: { id },
      include: { images: true }
    })

    if (!masterSwitch) {
      return NextResponse.json({ error: 'Master switch not found' }, { status: 404 })
    }

    // Check image count limit
    if (masterSwitch.images.length >= IMAGE_CONFIG.maxImagesPerSwitch) {
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

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Validate and get image metadata
    const validation = await validateAndProcessImage(buffer, file.type)
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || 'Invalid image' },
        { status: 400 }
      )
    }

    // Convert HEIC/HEIF to JPEG if needed
    let processedBuffer = buffer
    let fileExtension = getFileExtension(file.name)
    if (file.type === 'image/heic' || file.type === 'image/heif') {
      processedBuffer = await convertHeicToJpeg(buffer)
      fileExtension = 'jpg'
    }

    // Create image variants
    const variants = await createImageVariants(processedBuffer)

    // Generate unique image ID
    const imageId = crypto.randomUUID()

    // Upload to Vercel Blob (using 'master' as userId for master switches)
    const uploadPromises = [
      put(
        getImagePath('master', id, imageId, 'thumb', 'jpg'),
        variants.thumbnail,
        { 
          access: 'public',
          contentType: 'image/jpeg'
        }
      ),
      put(
        getImagePath('master', id, imageId, 'medium', 'jpg'),
        variants.medium,
        { 
          access: 'public',
          contentType: 'image/jpeg'
        }
      ),
      put(
        getImagePath('master', id, imageId, 'original', fileExtension),
        variants.original,
        { 
          access: 'public',
          contentType: file.type === 'image/heic' || file.type === 'image/heif' ? 'image/jpeg' : file.type
        }
      )
    ]

    const [thumbBlob, mediumBlob, originalBlob] = await Promise.all(uploadPromises)

    // Get the next order number
    const maxOrder = masterSwitch.images.length > 0
      ? Math.max(...masterSwitch.images.map(img => img.order))
      : -1

    // Create database record
    const image = await prisma.switchImage.create({
      data: {
        masterSwitchId: id,
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
    if (masterSwitch.images.length === 0) {
      await prisma.masterSwitch.update({
        where: { id: id },
        data: { primaryImageId: image.id }
      })
    }

    return NextResponse.json({
      ...image,
      thumbnailUrl: thumbBlob.url,
      mediumUrl: mediumBlob.url
    })
  } catch (error) {
    console.error('Failed to upload master switch image:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')

    if (!imageId) {
      return NextResponse.json({ error: 'Image ID required' }, { status: 400 })
    }

    // Verify image exists
    const image = await prisma.switchImage.findFirst({
      where: {
        id: imageId,
        masterSwitchId: id
      },
      include: {
        masterSwitch: true
      }
    })

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Delete from Vercel Blob (only for uploaded images)
    if (image.type === 'UPLOADED') {
      try {
        const urlParts = new URL(image.url).pathname.split('/')
        const fileName = urlParts[urlParts.length - 1]
        const baseImageId = fileName.split('.')[0].replace(/-original$/, '')
        
        await Promise.all([
          del(image.url).catch(() => {}),
          del(image.url.replace(`${baseImageId}.`, `${baseImageId}-thumb.`)).catch(() => {}),
          del(image.url.replace(`${baseImageId}.`, `${baseImageId}-medium.`)).catch(() => {})
        ])
      } catch (error) {
        console.error('Failed to delete from blob storage:', error)
      }
    }

    // Delete from database
    await prisma.switchImage.delete({
      where: { id: imageId }
    })

    // If this was the primary image, update to the next available image
    if (image.masterSwitch?.primaryImageId === imageId) {
      const nextImage = await prisma.switchImage.findFirst({
        where: {
          masterSwitchId: id,
          id: { not: imageId }
        },
        orderBy: { order: 'asc' }
      })

      await prisma.masterSwitch.update({
        where: { id: id },
        data: { primaryImageId: nextImage?.id || null }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete master switch image:', error)
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
  }
}