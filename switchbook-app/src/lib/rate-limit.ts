import { NextRequest } from 'next/server'

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
}

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory storage for rate limiting (consider Redis for production)
const rateLimitMap = new Map<string, RateLimitEntry>()

// Cleanup old entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, entry] of rateLimitMap.entries()) {
    if (now > entry.resetTime) {
      rateLimitMap.delete(key)
    }
  }
}, 60000) // Cleanup every minute

export function rateLimit(config: RateLimitConfig) {
  return (identifier: string): { allowed: boolean; remaining: number; resetTime: number } => {
    const now = Date.now()
    const windowEnd = now + config.windowMs
    
    const existing = rateLimitMap.get(identifier)
    
    if (!existing || now > existing.resetTime) {
      // New window or expired entry
      rateLimitMap.set(identifier, {
        count: 1,
        resetTime: windowEnd
      })
      return {
        allowed: true,
        remaining: config.maxRequests - 1,
        resetTime: windowEnd
      }
    }
    
    if (existing.count >= config.maxRequests) {
      // Rate limit exceeded
      return {
        allowed: false,
        remaining: 0,
        resetTime: existing.resetTime
      }
    }
    
    // Increment count
    existing.count++
    rateLimitMap.set(identifier, existing)
    
    return {
      allowed: true,
      remaining: config.maxRequests - existing.count,
      resetTime: existing.resetTime
    }
  }
}

export function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from various headers (for production with proxies)
  const forwarded = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')
  const ip = forwarded?.split(',')[0] || realIp || 'unknown'
  
  return ip
}

// Check if request is from authenticated web app user vs external API access
export function isAuthenticatedWebAppRequest(request: NextRequest): boolean {
  // Check for common web app indicators
  const userAgent = request.headers.get('user-agent') || ''
  const referer = request.headers.get('referer') || ''
  const origin = request.headers.get('origin') || ''
  
  // If it has a referer from our domain, it's likely from the web app
  const ourDomain = process.env.NEXTAUTH_URL || 'http://localhost:3000'
  if (referer.startsWith(ourDomain) || origin.startsWith(ourDomain)) {
    return true
  }
  
  // Check for browser user-agent patterns (vs programmatic access)
  const browserPatterns = [
    /Mozilla/i,
    /Chrome/i,
    /Safari/i,
    /Firefox/i,
    /Edge/i,
    /Opera/i
  ]
  
  return browserPatterns.some(pattern => pattern.test(userAgent))
}

// Enhanced rate limiting for large-scale operations
export const veryHighVolumeRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 5000 // 5000 requests per hour for authenticated bulk operations
})

// Pre-configured rate limiters for different endpoints
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5 // 5 requests per 15 minutes for auth endpoints
})

// More generous rate limiting for authenticated web app users
export const webAppApiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 2000 // Increased to 2000 requests per 15 minutes for web app users
})

// Stricter rate limiting for external/programmatic API access
export const externalApiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100 // 100 requests per 15 minutes for external API access
})

// Default API rate limit (maintains backward compatibility)
export const apiRateLimit = externalApiRateLimit

export const strictRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  maxRequests: 3 // 3 requests per hour for sensitive operations
})

// User-aware rate limiting that considers authentication status
export function createUserAwareRateLimit(userId?: string) {
  if (!userId) {
    // Unauthenticated users get strict limits
    return externalApiRateLimit
  }
  
  // Check if user has premium/admin status (future enhancement)
  // const userType = await getUserType(userId)
  // if (userType === 'premium') return premiumRateLimit
  
  // Default for authenticated users
  return webAppApiRateLimit
}