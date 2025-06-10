import { NextRequest, NextResponse } from 'next/server'
import { hasForceCurveDataCached } from '@/utils/forceCurveCache'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const switchName = searchParams.get('switchName')
    const manufacturer = searchParams.get('manufacturer')
    
    if (!switchName) {
      return NextResponse.json({ error: 'switchName is required' }, { status: 400 })
    }
    
    const result = await hasForceCurveDataCached(switchName, manufacturer || undefined)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error('[API] Error in force curve check:', error)
    return NextResponse.json({ error: 'Failed to check force curve' }, { status: 500 })
  }
}