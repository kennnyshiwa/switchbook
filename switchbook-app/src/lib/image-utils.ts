import sharp from 'sharp'
import { IMAGE_CONFIG } from './image-config'

export interface ImageMetadata {
  width: number
  height: number
  format: string
  size: number
}

export async function validateAndProcessImage(
  buffer: Buffer,
  mimeType: string
): Promise<{
  valid: boolean
  error?: string
  metadata?: ImageMetadata
}> {
  try {
    // Validate file signature (magic numbers)
    if (!isValidFileSignature(buffer, mimeType)) {
      return { valid: false, error: 'File type does not match its content' }
    }

    // Get image metadata
    const metadata = await sharp(buffer).metadata()
    
    if (!metadata.width || !metadata.height) {
      return { valid: false, error: 'Invalid image dimensions' }
    }

    // Check dimensions
    if (
      metadata.width > IMAGE_CONFIG.maxDimensions.width ||
      metadata.height > IMAGE_CONFIG.maxDimensions.height
    ) {
      return {
        valid: false,
        error: `Image dimensions exceed maximum allowed (${IMAGE_CONFIG.maxDimensions.width}x${IMAGE_CONFIG.maxDimensions.height})`
      }
    }

    return {
      valid: true,
      metadata: {
        width: metadata.width,
        height: metadata.height,
        format: metadata.format || 'unknown',
        size: buffer.length
      }
    }
  } catch (error) {
    return { valid: false, error: 'Failed to process image' }
  }
}

export async function createImageVariants(buffer: Buffer): Promise<{
  thumbnail: Buffer
  medium: Buffer
  original: Buffer
}> {
  // Strip EXIF data from original
  const original = await sharp(buffer)
    .rotate() // Auto-rotate based on EXIF
    .removeMetadata()
    .toBuffer()

  // Create thumbnail
  const thumbnail = await sharp(buffer)
    .rotate()
    .resize(
      IMAGE_CONFIG.imageSizes.thumbnail.width,
      IMAGE_CONFIG.imageSizes.thumbnail.height,
      {
        fit: 'cover',
        position: 'centre'
      }
    )
    .removeMetadata()
    .jpeg({ quality: 85 })
    .toBuffer()

  // Create medium size
  const medium = await sharp(buffer)
    .rotate()
    .resize(
      IMAGE_CONFIG.imageSizes.medium.width,
      IMAGE_CONFIG.imageSizes.medium.height,
      {
        fit: 'inside',
        withoutEnlargement: true
      }
    )
    .removeMetadata()
    .jpeg({ quality: 90 })
    .toBuffer()

  return { thumbnail, medium, original }
}

// Validate file signature (magic numbers)
function isValidFileSignature(buffer: Buffer, mimeType: string): boolean {
  const signatures: Record<string, number[][]> = {
    'image/jpeg': [[0xFF, 0xD8, 0xFF]],
    'image/jpg': [[0xFF, 0xD8, 0xFF]],
    'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
    'image/webp': [[0x52, 0x49, 0x46, 0x46], [0x57, 0x45, 0x42, 0x50]], // RIFF....WEBP
    'image/heic': [[0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]], // ftypheic
    'image/heif': [[0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x66]]  // ftypheif
  }

  const typeSignatures = signatures[mimeType.toLowerCase()]
  if (!typeSignatures) return false

  // For WEBP, check both RIFF and WEBP signatures
  if (mimeType.toLowerCase() === 'image/webp') {
    const riffMatch = typeSignatures[0].every((byte, index) => buffer[index] === byte)
    const webpMatch = typeSignatures[1].every((byte, index) => buffer[index + 8] === byte)
    return riffMatch && webpMatch
  }

  // For HEIC/HEIF, check at offset 4
  if (mimeType.toLowerCase() === 'image/heic' || mimeType.toLowerCase() === 'image/heif') {
    return typeSignatures[0].every((byte, index) => buffer[index + 4] === byte)
  }

  // For other formats, check from the beginning
  return typeSignatures.some(signature =>
    signature.every((byte, index) => buffer[index] === byte)
  )
}

// Convert HEIC/HEIF to JPEG
export async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  return await sharp(buffer)
    .rotate()
    .jpeg({ quality: 90 })
    .toBuffer()
}

// Generate a safe filename
export function generateSafeFilename(originalName: string): string {
  // Remove path components and sanitize
  const basename = originalName.split(/[\\/]/).pop() || 'image'
  // Replace unsafe characters
  return basename.replace(/[^a-zA-Z0-9.-]/g, '_').toLowerCase()
}