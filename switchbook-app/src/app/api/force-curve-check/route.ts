import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const switchName = searchParams.get('switchName')
    const manufacturer = searchParams.get('manufacturer')
    
    if (!switchName) {
      return NextResponse.json({ error: 'switchName is required' }, { status: 400 })
    }
    
    const normalizedManufacturer = manufacturer || null
    
    // ONLY check cache, NEVER make GitHub API calls
    const cached = await prisma.forceCurveCache.findFirst({
      where: {
        switchName,
        manufacturer: normalizedManufacturer
      }
    })

    const now = new Date()
    
    // If we have a cached result and it's still valid
    if (cached && (!cached.nextCheckAt || cached.nextCheckAt > now)) {
      return NextResponse.json({
        hasForceCurve: cached.hasForceCurve,
        fromCache: true
      })
    }
    
    // If no valid cache, return that we need to check (but don't actually check here)
    return NextResponse.json({
      hasForceCurve: false,
      fromCache: false,
      needsCheck: true
    })
    
  } catch (error) {
    console.error('[API] Error in force curve check:', error)
    return NextResponse.json({ error: 'Failed to check force curve' }, { status: 500 })
  }
}