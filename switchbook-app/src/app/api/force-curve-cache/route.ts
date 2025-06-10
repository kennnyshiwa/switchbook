import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const now = new Date()
    
    // Get all cache entries that are still valid
    const cacheEntries = await prisma.forceCurveCache.findMany({
      where: {
        OR: [
          { nextCheckAt: null },
          { nextCheckAt: { gt: now } }
        ]
      },
      select: {
        switchName: true,
        manufacturer: true,
        hasForceCurve: true,
        lastCheckedAt: true,
        nextCheckAt: true
      }
    })
    
    return NextResponse.json(cacheEntries)
  } catch (error) {
    console.error('Error fetching force curve cache:', error)
    return NextResponse.json({ error: 'Failed to fetch cache' }, { status: 500 })
  }
}