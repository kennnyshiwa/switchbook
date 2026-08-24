import { createHash } from 'crypto'
import { NextResponse } from 'next/server'

export function cacheableJson(request: Request, body: unknown, updatedAt?: Date) {
  const encoded = JSON.stringify(body)
  const etag = `\"${createHash('sha256').update(encoded).digest('base64url')}\"`
  const lastModified = (updatedAt || new Date()).toUTCString()
  const headers = {
    ETag: etag,
    'Last-Modified': lastModified,
    'Cache-Control': 'private, max-age=300, stale-if-error=86400',
    Vary: 'Authorization, X-API-Key',
  }
  if (request.headers.get('if-none-match') === etag ||
      request.headers.get('if-modified-since') && new Date(request.headers.get('if-modified-since')!).getTime() >= new Date(lastModified).getTime()) {
    return new NextResponse(null, { status: 304, headers })
  }
  return NextResponse.json(body, { headers })
}
