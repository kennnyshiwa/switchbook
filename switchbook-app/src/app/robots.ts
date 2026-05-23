import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/switches/browse', '/switches/'],
      disallow: ['/admin/', '/dashboard/', '/settings/', '/wishlist/', '/api/', '/auth/'],
    },
    sitemap: 'https://switchbook.app/sitemap.xml',
  }
}
