import { uploadFile } from './local-storage'
import { isValidImageType } from './image-config'
import { assertPublicImageHost, validateImageUrl } from './image-security'
import { convertHeicToJpeg, generateSafeFilename, validateAndProcessImage } from './image-utils'
import { createHash } from 'node:crypto'

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
  const MAX_BYTES = 12 * 1024 * 1024
  let currentUrl = remoteUrl
  let response: Response | undefined
  for (let redirect = 0; redirect <= 3; redirect++) {
    const validation = validateImageUrl(currentUrl)
    if (!validation.valid) throw new Error(validation.error || 'Invalid remote image URL')
    await assertPublicImageHost(currentUrl)
    response = await fetch(currentUrl, { redirect: 'manual', signal: AbortSignal.timeout(10_000), headers: { Accept: 'image/*' } })
    if (![301, 302, 303, 307, 308].includes(response.status)) break
    const location = response.headers.get('location')
    if (!location || redirect === 3) throw new Error('Remote image exceeded redirect limit')
    currentUrl = new URL(location, currentUrl).toString()
  }
  if (!response) throw new Error('Failed to download remote image')
  if (!response.ok) {
    throw new Error(`Failed to download remote image (${response.status})`)
  }

  const declaredSize = Number(response.headers.get('content-length') || 0)
  if (declaredSize > MAX_BYTES) throw new Error('Remote image exceeds 12 MB limit')

  let mimeType = normalizeMimeType(response.headers.get('content-type'), remoteUrl)
  if (!isValidImageType(mimeType)) {
    throw new Error(`Unsupported remote image type: ${mimeType}`)
  }

  if (!response.body) throw new Error('Remote image response had no body')
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > MAX_BYTES) { await reader.cancel(); throw new Error('Remote image exceeds 12 MB limit') }
    chunks.push(value)
  }
  const buffer = Buffer.concat(chunks)

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
    checksumSha256: createHash('sha256').update(processedBuffer).digest('hex'),
  }
}
