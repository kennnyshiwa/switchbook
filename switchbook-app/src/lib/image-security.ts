/**
 * Image security utilities for validating and sanitizing image URLs
 */
import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'
import { Agent, fetch as undiciFetch, type RequestInit as UndiciRequestInit } from 'undici'

// Blocked hostnames that should never be accessed
const BLOCKED_HOSTNAMES = [
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  'metadata.google.internal', // Google Cloud metadata
  '169.254.169.254', // AWS metadata
  'metadata.azure.com', // Azure metadata
]

// Blocked top-level domains
const BLOCKED_TLDS = [
  '.local',
  '.internal',
  '.lan',
  '.intranet',
]

// Allowed image file extensions
const ALLOWED_IMAGE_EXTENSIONS = [
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.bmp', '.ico'
]

// Maximum image URL length
const MAX_URL_LENGTH = 2048

/**
 * Validates an image URL for security concerns
 */
export function validateImageUrl(url: string): { valid: boolean; error?: string } {
  // Basic URL length check
  if (url.length > MAX_URL_LENGTH) {
    return { valid: false, error: 'URL too long' }
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return { valid: false, error: 'Invalid URL format' }
  }

  // Only allow HTTPS
  if (parsedUrl.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTPS URLs are allowed' }
  }

  // Check for blocked hostnames
  const hostname = parsedUrl.hostname.toLowerCase()
  
  // Block internal/local addresses
  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    return { valid: false, error: 'Internal addresses not allowed' }
  }

  // Block private IP ranges
  if (isPrivateIP(hostname)) {
    return { valid: false, error: 'Private IP addresses not allowed' }
  }

  // Check for blocked TLDs
  if (BLOCKED_TLDS.some(tld => hostname.endsWith(tld))) {
    return { valid: false, error: 'Internal domains not allowed' }
  }

  // Check file extension (if present in path)
  const pathname = parsedUrl.pathname.toLowerCase()
  const hasExtension = pathname.includes('.')
  
  if (hasExtension) {
    const hasValidExtension = ALLOWED_IMAGE_EXTENSIONS.some(ext => 
      pathname.endsWith(ext)
    )
    
    if (!hasValidExtension) {
      return { valid: false, error: 'Invalid file extension for image' }
    }
  }

  // Check for suspicious patterns
  if (pathname.includes('..') || pathname.includes('%2e%2e')) {
    return { valid: false, error: 'Path traversal not allowed' }
  }

  return { valid: true }
}

/**
 * Checks if a hostname represents a private IP address
 */
function isPrivateIP(hostname: string): boolean {
  // IPv4 private ranges
  const ipv4Patterns = [
    /^10\./,                    // 10.0.0.0/8
    /^172\.(1[6-9]|2[0-9]|3[01])\./, // 172.16.0.0/12
    /^192\.168\./,              // 192.168.0.0/16
    /^127\./,                   // 127.0.0.0/8 (loopback)
    /^169\.254\./,              // 169.254.0.0/16 (link-local)
  ]

  // IPv6 private/local patterns
  const ipv6Patterns = [
    /^fe80:/i,                  // Link-local
    /^fc00:/i,                  // Unique local
    /^fd00:/i,                  // Unique local
    /^::1$/i,                   // Loopback
  ]

  return ipv4Patterns.some(pattern => pattern.test(hostname)) ||
         ipv6Patterns.some(pattern => pattern.test(hostname))
}

export function isUnsafeResolvedAddress(address: string): boolean {
  if (address.startsWith('::ffff:')) return isUnsafeResolvedAddress(address.slice(7))
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number)
    return a === 0 || a === 10 || a === 127 || a >= 224 ||
      a === 169 && b === 254 || a === 172 && b >= 16 && b <= 31 ||
      a === 192 && b === 168 || a === 100 && b >= 64 && b <= 127 ||
      a === 198 && (b === 18 || b === 19 || b === 51) ||
      a === 192 && b === 0 || a === 203 && b === 0
  }
  const normalized = address.toLowerCase()
  return normalized === '::' || normalized === '::1' || normalized.startsWith('fc') ||
    normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') ||
    normalized.startsWith('fea') || normalized.startsWith('feb')
}

/** Resolve immediately before every remote fetch to prevent DNS rebinding into private networks. */
export async function assertPublicImageHost(rawUrl: string) {
  const parsed = new URL(rawUrl)
  const answers = await lookup(parsed.hostname, { all: true, verbatim: true })
  if (!answers.length || answers.some(answer => isUnsafeResolvedAddress(answer.address))) {
    throw new Error('Image host resolves to a private or reserved address')
  }
}

type DnsAnswer = { address: string; family: number }
type Resolver = (hostname: string) => Promise<DnsAnswer[]>

export async function resolvePublicHost(hostname: string, resolver: Resolver = async host => lookup(host, { all: true, verbatim: true })) {
  const answers = await resolver(hostname)
  if (!answers.length || answers.some(answer => isUnsafeResolvedAddress(answer.address))) {
    throw new Error('Remote host resolves to a private or reserved address')
  }
  return answers[0]
}

/** Resolve once, validate every answer, then pin the actual socket to that address. */
export async function pinnedPublicFetch(rawUrl: string, init: RequestInit = {}) {
  const url = new URL(rawUrl)
  const pinned = await resolvePublicHost(url.hostname)
  const dispatcher = new Agent({ connect: {
    lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
  } })
  try {
    const response = await undiciFetch(url, { ...(init as UndiciRequestInit), dispatcher })
    return { response: response as unknown as Response, close: () => dispatcher.close() }
  } catch (error) {
    await dispatcher.close()
    throw error
  }
}

/**
 * Enhanced image URL validation with additional security checks
 */
export function validateImageUrlAdvanced(url: string): { valid: boolean; error?: string; sanitizedUrl?: string } {
  const basicValidation = validateImageUrl(url)
  
  if (!basicValidation.valid) {
    return basicValidation
  }

  try {
    const parsedUrl = new URL(url)
    
    // Remove potentially dangerous query parameters
    const dangerousParams = ['callback', 'jsonp', 'script', 'redirect', 'url']
    dangerousParams.forEach(param => {
      parsedUrl.searchParams.delete(param)
    })

    // Normalize the URL
    const sanitizedUrl = parsedUrl.toString()

    return { 
      valid: true, 
      sanitizedUrl 
    }
  } catch {
    return { valid: false, error: 'Failed to sanitize URL' }
  }
}

/**
 * Rate limiting for image URL validation (per IP)
 */
const imageValidationAttempts = new Map<string, { count: number; resetTime: number }>()

export function checkImageValidationRateLimit(clientIP: string): boolean {
  const now = Date.now()
  const windowMs = 60 * 1000 // 1 minute
  const maxAttempts = 20 // Max 20 image validations per minute per IP

  const existing = imageValidationAttempts.get(clientIP)
  
  if (!existing || now > existing.resetTime) {
    imageValidationAttempts.set(clientIP, {
      count: 1,
      resetTime: now + windowMs
    })
    return true
  }

  if (existing.count >= maxAttempts) {
    return false
  }

  existing.count++
  return true
}

// Cleanup old entries periodically
const imageRateLimitCleanup = setInterval(() => {
  const now = Date.now()
  for (const [ip, data] of imageValidationAttempts.entries()) {
    if (now > data.resetTime) {
      imageValidationAttempts.delete(ip)
    }
  }
}, 60000) // Cleanup every minute
imageRateLimitCleanup.unref()
