import { NextRequest, NextResponse } from 'next/server'
import { getApprovedCurves } from '@/lib/force-curves'
export async function GET(request: NextRequest) {
  const id = new URL(request.url).searchParams.get('masterSwitchId')
  if (!id) return NextResponse.json({ hasForceCurve: false, source: 'canonical', needsMasterSwitchId: true })
  return NextResponse.json({ hasForceCurve: (await getApprovedCurves(id)).length > 0, source: 'canonical' })
}
