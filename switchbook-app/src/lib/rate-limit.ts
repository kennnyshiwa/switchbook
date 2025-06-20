import { IMAGE_CONFIG } from './image-config'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// Simple in-memory rate limiting
// In production, consider using Redis or a similar solution
const rateLimitMap = new Map<string, RateLimitEntry>()

export function checkRateLimit(userId: string): {
  allowed: boolean
  remaining: number
  resetTime: number
} {
  const now = Date.now()
  const userLimit = rateLimitMap.get(userId)

  // Clean up expired entries periodically
  if (Math.random() < 0.01) {
    cleanupExpiredEntries()
  }

  if (!userLimit || now > userLimit.resetTime) {
    // First request or limit expired
    rateLimitMap.set(userId, {
      count: 1,
      resetTime: now + IMAGE_CONFIG.rateLimits.windowMs
    })
    return {
      allowed: true,
      remaining: IMAGE_CONFIG.rateLimits.maxUploadsPerMinute - 1,
      resetTime: now + IMAGE_CONFIG.rateLimits.windowMs
    }
  }

  if (userLimit.count >= IMAGE_CONFIG.rateLimits.maxUploadsPerMinute) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: userLimit.resetTime
    }
  }

  // Increment count
  userLimit.count++
  rateLimitMap.set(userId, userLimit)

  return {
    allowed: true,
    remaining: IMAGE_CONFIG.rateLimits.maxUploadsPerMinute - userLimit.count,
    resetTime: userLimit.resetTime
  }
}

function cleanupExpiredEntries() {
  const now = Date.now()
  for (const [userId, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(userId)
    }
  }
}