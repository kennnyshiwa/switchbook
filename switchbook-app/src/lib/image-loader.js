export default function myImageLoader({ src, width, quality }) {
  // Always use HTTPS in production
  if (process.env.NODE_ENV === 'production') {
    // Force HTTPS for production
    return `https://switchbook.app/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`
  }

  // In development, use the default loader
  if (typeof window !== 'undefined') {
    const protocol = window.location.protocol
    const host = window.location.host
    return `${protocol}//${host}/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`
  }

  // Fallback for SSR
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=${quality || 75}`
}