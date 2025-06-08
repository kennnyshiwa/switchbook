import { NextRequest, NextResponse } from 'next/server'
import { getClientIdentifier, isAuthenticatedWebAppRequest, webAppApiRateLimit, externalApiRateLimit } from './rate-limit'

type RateLimitFunction = (identifier: string) => { allowed: boolean; remaining: number; resetTime: number }
type ApiHandler = (request: NextRequest, ...args: any[]) => Promise<NextResponse> | NextResponse

export function withRateLimit(rateLimitFn: RateLimitFunction, handler: ApiHandler) {
  return async (request: NextRequest, ...args: any[]) => {
    const identifier = getClientIdentifier(request)
    const { allowed, remaining, resetTime } = rateLimitFn(identifier)
    
    if (!allowed) {
      return NextResponse.json(
        { 
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': '5',
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': resetTime.toString()
          }
        }
      )
    }
    
    const response = await handler(request, ...args)
    
    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', resetTime.toString())
    
    return response
  }
}

// Smart rate limiting that chooses appropriate limits based on request type
export function withSmartRateLimit(handler: ApiHandler) {
  return async (request: NextRequest, ...args: any[]) => {
    const identifier = getClientIdentifier(request)
    
    // Choose rate limiter based on request characteristics
    const rateLimitFn = isAuthenticatedWebAppRequest(request) 
      ? webAppApiRateLimit 
      : externalApiRateLimit
    
    const { allowed, remaining, resetTime } = rateLimitFn(identifier)
    const limit = isAuthenticatedWebAppRequest(request) ? '2000' : '100'
    
    if (!allowed) {
      return NextResponse.json(
        { 
          error: 'Too many requests. Please try again later.',
          retryAfter: Math.ceil((resetTime - Date.now()) / 1000)
        },
        { 
          status: 429,
          headers: {
            'Retry-After': Math.ceil((resetTime - Date.now()) / 1000).toString(),
            'X-RateLimit-Limit': limit,
            'X-RateLimit-Remaining': remaining.toString(),
            'X-RateLimit-Reset': resetTime.toString()
          }
        }
      )
    }
    
    const response = await handler(request, ...args)
    
    // Add rate limit headers to successful responses
    response.headers.set('X-RateLimit-Limit', limit)
    response.headers.set('X-RateLimit-Remaining', remaining.toString())
    response.headers.set('X-RateLimit-Reset', resetTime.toString())
    
    return response
  }
}