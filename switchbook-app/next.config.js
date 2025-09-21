/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**', // Allow any HTTPS domain for user-uploaded images
      },
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
    // Security configurations for image handling
    minimumCacheTTL: 60,
    dangerouslyAllowSVG: false, // Prevent SVG execution
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; img-src 'self' data: https: blob:; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; connect-src 'self' https://api.github.com https://raw.githubusercontent.com; frame-src 'self' http://localhost:3002; frame-ancestors 'none'; object-src 'none'; base-uri 'self';",
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig