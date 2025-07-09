/**
 * Image optimization utilities for better performance and caching
 */

/**
 * Preload critical images to improve perceived performance
 * @param urls Array of image URLs to preload
 */
export function preloadImages(urls: string[]) {
  urls.forEach(url => {
    if (url && typeof window !== 'undefined') {
      const link = document.createElement('link')
      link.rel = 'preload'
      link.as = 'image'
      link.href = url
      document.head.appendChild(link)
    }
  })
}

/**
 * Generate srcset for responsive images
 * @param baseUrl The base image URL
 * @param sizes Array of width sizes to generate
 */
export function generateSrcSet(baseUrl: string, sizes: number[] = [320, 640, 960, 1280]): string {
  // For uploaded images, we don't have automatic resizing, so return the base URL
  // This is a placeholder for future image optimization service integration
  return sizes.map(size => `${baseUrl} ${size}w`).join(', ')
}

/**
 * Get optimal image format based on browser support
 */
export function getOptimalFormat(): 'webp' | 'avif' | 'jpeg' {
  if (typeof window === 'undefined') return 'jpeg'
  
  // Check for AVIF support
  const avifSupport = document.createElement('canvas').toDataURL('image/avif').indexOf('image/avif') === 5
  if (avifSupport) return 'avif'
  
  // Check for WebP support
  const webpSupport = document.createElement('canvas').toDataURL('image/webp').indexOf('image/webp') === 5
  if (webpSupport) return 'webp'
  
  return 'jpeg'
}

/**
 * Add cache headers to image requests
 * This is mainly for documentation - actual headers are set by nginx/Cloudflare
 */
export const IMAGE_CACHE_HEADERS = {
  'Cache-Control': 'public, max-age=31536000, immutable',
  'Vary': 'Accept'
}

/**
 * Check if an image URL is from our CDN/uploads
 */
export function isLocalImage(url: string): boolean {
  if (!url) return false
  return url.includes('/uploads/') || url.startsWith('/uploads/')
}

/**
 * Get image URL with cache busting for updated images
 * @param url The image URL
 * @param version Optional version/timestamp for cache busting
 */
export function getVersionedImageUrl(url: string, version?: string | number): string {
  if (!url || !version) return url
  
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${version}`
}

/**
 * Lazy load images with Intersection Observer
 * @param selector CSS selector for images to lazy load
 */
export function initLazyLoading(selector: string = 'img[loading="lazy"]') {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) return
  
  const images = document.querySelectorAll(selector)
  
  const imageObserver = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const img = entry.target as HTMLImageElement
        if (img.dataset.src) {
          img.src = img.dataset.src
          img.removeAttribute('data-src')
        }
        observer.unobserve(img)
      }
    })
  }, {
    rootMargin: '50px 0px', // Start loading 50px before entering viewport
    threshold: 0.01
  })
  
  images.forEach(img => imageObserver.observe(img))
  
  return imageObserver
}