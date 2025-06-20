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
  console.log('getImageUrl called with:', url)
  
  if (!url || url.trim() === '') {
    console.log('getImageUrl returning null - empty or null URL')
    return null
  }
  
  // Check if the URL is expired (for Notion URLs)
  if (url.includes('exp=')) {
    const expMatch = url.match(/exp=(\d+)/)
    if (expMatch) {
      const expirationTime = parseInt(expMatch[1]) * 1000 // Convert to milliseconds
      const currentTime = Date.now()
      console.log('Checking expiration:', { expirationTime, currentTime, expired: currentTime > expirationTime })
      if (currentTime > expirationTime) {
        console.warn('Image URL expired:', url)
        return null
      }
    }
  }
  
  // Use proxy for problematic domains
  if (needsProxy(url)) {
    const proxiedUrl = `/api/proxy-image?url=${encodeURIComponent(url)}`
    console.log('Using proxy for URL:', { original: url, proxied: proxiedUrl })
    return proxiedUrl
  }
  
  console.log('getImageUrl returning original URL:', url)
  return url
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