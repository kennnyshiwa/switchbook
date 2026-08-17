import { uploadFile } from './local-storage'
import { isValidImageType } from './image-config'
import { validateImageUrl } from './image-security'
import { convertHeicToJpeg, generateSafeFilename, validateAndProcessImage } from './image-utils'

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/heic': '.heic',
  'image/heif': '.heif',
}

function getExtensionForMimeType(mimeType: string): string {
  return MIME_EXTENSION_MAP[mimeType.toLowerCase()] || '.jpg'
}

function getFilenameFromUrl(remoteUrl: string, mimeType: string): string {
  const pathname = new URL(remoteUrl).pathname
  const rawName = pathname.split('/').pop() || `image${getExtensionForMimeType(mimeType)}`
  const sanitizedName = generateSafeFilename(rawName)

  if (/\.[a-z0-9]+$/i.test(sanitizedName)) {
    return sanitizedName
  }

  return `${sanitizedName}${getExtensionForMimeType(mimeType)}`
}

function normalizeMimeType(contentType: string | null, remoteUrl: string): string {
  const baseType = contentType?.split(';')[0]?.trim().toLowerCase()
  if (baseType && isValidImageType(baseType)) {
    return baseType
  }

  const pathname = new URL(remoteUrl).pathname.toLowerCase()
  if (pathname.endsWith('.png')) return 'image/png'
  if (pathname.endsWith('.webp')) return 'image/webp'
  if (pathname.endsWith('.heic')) return 'image/heic'
  if (pathname.endsWith('.heif')) return 'image/heif'

  return 'image/jpeg'
}

export async function rehostRemoteImage(remoteUrl: string, folder: string) {
  const validation = validateImageUrl(remoteUrl)
  if (!validation.valid) {
    throw new Error(validation.error || 'Invalid remote image URL')
  }

  const response = await fetch(remoteUrl)
  if (!response.ok) {
    throw new Error(`Failed to download remote image (${response.status})`)
  }

  let mimeType = normalizeMimeType(response.headers.get('content-type'), remoteUrl)
  if (!isValidImageType(mimeType)) {
    throw new Error(`Unsupported remote image type: ${mimeType}`)
  }

  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const imageValidation = await validateAndProcessImage(buffer, mimeType)
  if (!imageValidation.valid) {
    throw new Error(imageValidation.error || 'Remote image failed validation')
  }

  let processedBuffer: Buffer<ArrayBufferLike> = buffer
  let filename = getFilenameFromUrl(remoteUrl, mimeType)

  if (mimeType === 'image/heic' || mimeType === 'image/heif') {
    processedBuffer = await convertHeicToJpeg(buffer)
    mimeType = 'image/jpeg'
    filename = filename.replace(/\.(heic|heif)$/i, '.jpg')
  }

  const uploadArrayBuffer = processedBuffer.buffer.slice(
    processedBuffer.byteOffset,
    processedBuffer.byteOffset + processedBuffer.byteLength
  ) as ArrayBuffer

  const file = new File([uploadArrayBuffer], filename, {
    type: mimeType,
  })

  const uploaded = await uploadFile(file, folder)

  return {
    ...uploaded,
    width: imageValidation.metadata?.width ?? null,
    height: imageValidation.metadata?.height ?? null,
    size: file.size,
  }
}
