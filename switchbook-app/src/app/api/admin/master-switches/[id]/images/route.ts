import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadFile, deleteFile } from '@/lib/local-storage'
import { 
  IMAGE_CONFIG, 
  isValidImageType, 
  isValidFileSize,
  getFileExtension,
  isValidExtension
} from '@/lib/image-config'
import { 
  validateAndProcessImage, 
  convertHeicToJpeg
} from '@/lib/image-utils'
import crypto from 'crypto'

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
    let processedBuffer = buffer
    let processedFile = file
    if (file.type === 'image/heic' || file.type === 'image/heif') {
      processedBuffer = await convertHeicToJpeg(buffer)
      processedFile = new File([processedBuffer], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg'
      })
    }

    // Upload to local storage
    const folder = `master-switches/${id}`
    const { url, pathname } = await uploadFile(processedFile, folder)

    // Get the next order number
    const maxOrder = masterSwitch.images.length > 0
      ? Math.max(...masterSwitch.images.map(img => img.order))
      : -1

    // Create database record
    const image = await prisma.switchImage.create({
      data: {
        masterSwitchId: id,
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
    if (masterSwitch.images.length === 0) {
      await prisma.masterSwitch.update({
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
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')

    if (!imageId) {
      return NextResponse.json({ error: 'Image ID required' }, { status: 400 })
    }

    // Verify image exists and belongs to this master switch
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

    // Delete from local storage
    try {
      const pathname = image.url.replace('/uploads/', '')
      await deleteFile(pathname)
    } catch (error) {
      console.error('Failed to delete file from storage:', error)
    }

    // Delete from database
    await prisma.switchImage.delete({
      where: { id: imageId }
    })

    // If this was the primary image, update to next available
    if (image.masterSwitch.imageUrl === image.url) {
      const remainingImages = await prisma.switchImage.findMany({
        where: { masterSwitchId: id },
        orderBy: { order: 'asc' },
        take: 1
      })

      await prisma.masterSwitch.update({
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