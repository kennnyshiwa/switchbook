import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const imageUrl = request.nextUrl.searchParams.get('url')
    
    if (!imageUrl) {
      return new NextResponse('Missing URL parameter', { status: 400 })
    }

    // Decode the URL
    const decodedUrl = decodeURIComponent(imageUrl)
    
    // Fetch the image
    const response = await fetch(decodedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
        'Referer': decodedUrl.split('/').slice(0, 3).join('/') + '/'
      }
    })

    if (!response.ok) {
      console.error('Image fetch failed:', response.status, response.statusText)
      return new NextResponse('Failed to fetch image', { status: response.status })
    }

    const contentType = response.headers.get('content-type')
    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType || 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
      }
    })
  } catch (error) {
    console.error('Proxy image error:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}