import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { uploadFile } from '@/lib/local-storage'
import {
  IMAGE_CONFIG,
  isValidExtension,
  isValidFileSize,
  isValidImageType,
} from '@/lib/image-config'
import { checkRateLimit } from '@/lib/rate-limit'
import { convertHeicToJpeg, validateAndProcessImage } from '@/lib/image-utils'
import { MasterSwitchStatus } from '@prisma/client'

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

    const masterSwitch = await prisma.masterSwitch.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    })

    if (!masterSwitch || masterSwitch.status !== MasterSwitchStatus.APPROVED) {
      return NextResponse.json({ error: 'Master switch not found' }, { status: 404 })
    }

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

    const { url } = await uploadFile(
      processedFile,
      `master-switch-edit-suggestions/${id}/${session.user.id}`
    )

    return NextResponse.json({ url })
  } catch (error) {
    console.error('Failed to upload master switch suggestion image:', error)
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
  }
}
