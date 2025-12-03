/**
 * Check if an image URL needs to be proxied
 */
export function needsProxy(url: string): boolean {
  // Check for URLs that commonly have issues
  const problematicDomains = [
    'notionusercontent.com',
    'rackcdn.com',
    'razerzone.com'
  ]
  
  return problematicDomains.some(domain => url.includes(domain))
}

/**
 * Get the appropriate image URL (proxied if necessary)
 */
export function getImageUrl(url: string | null | undefined): string | null {
  if (!url || url.trim() === '') {
    return null
  }

  // Enforce HTTPS protocol for external URLs
  let processedUrl = url
  if (processedUrl.startsWith('http://')) {
    processedUrl = processedUrl.replace('http://', 'https://')
  }

  // Check if the URL is expired (for Notion URLs)
  if (processedUrl.includes('exp=')) {
    const expMatch = processedUrl.match(/exp=(\d+)/)
    if (expMatch) {
      const expirationTime = parseInt(expMatch[1]) * 1000 // Convert to milliseconds
      if (Date.now() > expirationTime) {
        return null
      }
    }
  }

  // Use proxy for problematic domains
  if (needsProxy(processedUrl)) {
    return `/api/proxy-image?url=${encodeURIComponent(processedUrl)}`
  }

  return processedUrl
}

/**
 * Validate if a URL is a valid image URL
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}