import { NextRequest, NextResponse } from 'next/server'
import { batchCheckForceCurves } from '@/utils/forceCurveCache'

export async function POST(request: NextRequest) {
  try {
    const { switches } = await request.json()
    
    if (!Array.isArray(switches)) {
      return NextResponse.json({ error: 'Switches must be an array' }, { status: 400 })
    }
    
    const results = await batchCheckForceCurves(switches)
    
    // Convert Map to object for JSON serialization
    const resultsObject = Object.fromEntries(results)
    
    return NextResponse.json(resultsObject)
  } catch (error) {
    console.error('[API] Error in force curve batch check:', error)
    return NextResponse.json({ error: 'Failed to batch check force curves' }, { status: 500 })
  }
}