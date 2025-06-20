export const IMAGE_CONFIG = {
  maxFileSize: 5 * 1024 * 1024, // 5MB
  maxTotalStoragePerUser: 100 * 1024 * 1024, // 100MB
  maxImagesPerSwitch: 10,
  allowedMimeTypes: [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif'
  ],
  allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'],
  imageSizes: {
    thumbnail: { width: 400, height: 400 },
    medium: { width: 800, height: 800 }
  },
  maxDimensions: {
    width: 4000,
    height: 4000
  },
  rateLimits: {
    maxUploadsPerMinute: 10,
    windowMs: 60 * 1000 // 1 minute
  }
} as const

export function getImagePath(userId: string, switchId: string, imageId: string, size: 'thumb' | 'medium' | 'original', ext: string) {
  const sizePrefix = size === 'original' ? '' : `-${size}`
  return `switches/${userId}/${switchId}/${imageId}${sizePrefix}.${ext}`
}

export function isValidImageType(mimeType: string): boolean {
  const allowedTypes = IMAGE_CONFIG.allowedMimeTypes as readonly string[]
  return allowedTypes.includes(mimeType.toLowerCase())
}

export function isValidFileSize(size: number): boolean {
  return size > 0 && size <= IMAGE_CONFIG.maxFileSize
}

export function getFileExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  return ext || ''
}

export function isValidExtension(filename: string): boolean {
  const ext = `.${getFileExtension(filename)}`
  const allowedExtensions = IMAGE_CONFIG.allowedExtensions as readonly string[]
  return allowedExtensions.includes(ext)
}