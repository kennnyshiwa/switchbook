import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadFile, deleteFile } from '@/lib/local-storage'
import {
  IMAGE_CONFIG,
  isValidExtension,
  isValidFileSize,
  isValidImageType,
} from '@/lib/image-config'
import { checkRateLimit } from '@/lib/rate-limit'
import { convertHeicToJpeg, validateAndProcessImage } from '@/lib/image-utils'

async function getEditableMasterSwitch(masterSwitchId: string, userId: string, isAdmin: boolean) {
  const masterSwitch = await prisma.masterSwitch.findUnique({
    where: { id: masterSwitchId },
    include: { images: true },
  })

  if (!masterSwitch) {
    return { error: NextResponse.json({ error: 'Master switch not found' }, { status: 404 }) }
  }

  const canEdit =
    isAdmin ||
    (masterSwitch.submittedById === userId && masterSwitch.status === 'PENDING')

  if (!canEdit) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  return { masterSwitch }
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
    const editable = await getEditableMasterSwitch(id, session.user.id, session.user.role === 'ADMIN')
    if (editable.error) {
      return editable.error
    }

    const { masterSwitch } = editable

    const rateLimit = checkRateLimit(session.user.id)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Too many uploads. Please try again later.',
          retryAfter: rateLimit.resetTime,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(IMAGE_CONFIG.rateLimits.maxUploadsPerMinute),
            'X-RateLimit-Remaining': String(rateLimit.remaining),
            'X-RateLimit-Reset': String(rateLimit.resetTime),
          },
        }
      )
    }

    if (masterSwitch.images.length >= IMAGE_CONFIG.maxImagesPerSwitch) {
      return NextResponse.json(
        { error: `Maximum ${IMAGE_CONFIG.maxImagesPerSwitch} images allowed per switch` },
        { status: 400 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!isValidImageType(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Allowed types: JPEG, PNG, WebP, HEIC' },
        { status: 400 }
      )
    }

    if (!isValidExtension(file.name)) {
      return NextResponse.json({ error: 'Invalid file extension' }, { status: 400 })
    }

    if (!isValidFileSize(file.size)) {
      return NextResponse.json(
        { error: `File size must not exceed ${IMAGE_CONFIG.maxFileSize / 1024 / 1024}MB` },
        { status: 400 }
      )
    }

    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    const validation = await validateAndProcessImage(buffer, file.type)
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error || 'Invalid image' }, { status: 400 })
    }

    let processedFile = file
    if (file.type === 'image/heic' || file.type === 'image/heif') {
      const convertedBuffer = await convertHeicToJpeg(buffer)
      const convertedArrayBuffer = convertedBuffer.buffer.slice(
        convertedBuffer.byteOffset,
        convertedBuffer.byteOffset + convertedBuffer.byteLength
      ) as ArrayBuffer
      processedFile = new File([convertedArrayBuffer], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg',
      })
    }

    const { url } = await uploadFile(processedFile, `master-switches/${id}`)
    const maxOrder = masterSwitch.images.length > 0
      ? Math.max(...masterSwitch.images.map((image) => image.order))
      : -1

    const image = await prisma.switchImage.create({
      data: {
        masterSwitchId: id,
        url,
        type: 'UPLOADED',
        order: maxOrder + 1,
        width: validation.metadata?.width,
        height: validation.metadata?.height,
        size: processedFile.size,
      },
    })

    if (masterSwitch.images.length === 0) {
      await prisma.masterSwitch.update({
        where: { id },
        data: {
          imageUrl: url,
          primaryImageId: image.id,
        },
      })
    }

    return NextResponse.json(image)
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
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const editable = await getEditableMasterSwitch(id, session.user.id, session.user.role === 'ADMIN')
    if (editable.error) {
      return editable.error
    }

    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')

    if (!imageId) {
      return NextResponse.json({ error: 'Image ID required' }, { status: 400 })
    }

    const image = await prisma.switchImage.findFirst({
      where: {
        id: imageId,
        masterSwitchId: id,
      },
      include: {
        masterSwitch: true,
      },
    })

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    try {
      const pathname = image.url.replace('/uploads/', '')
      await deleteFile(pathname)
    } catch (error) {
      console.error('Failed to delete file from storage:', error)
    }

    await prisma.switchImage.delete({
      where: { id: imageId },
    })

    if (image.masterSwitch?.imageUrl === image.url) {
      const remainingImage = await prisma.switchImage.findFirst({
        where: { masterSwitchId: id },
        orderBy: { order: 'asc' },
      })

      await prisma.masterSwitch.update({
        where: { id },
        data: {
          imageUrl: remainingImage?.url || null,
          primaryImageId: remainingImage?.id || null,
        },
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete master switch image:', error)
    return NextResponse.json({ error: 'Failed to delete image' }, { status: 500 })
  }
}
