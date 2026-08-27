import { NextRequest, NextResponse } from 'next/server'
import { getApprovedCurves } from '@/lib/force-curves'
export async function POST(request: NextRequest) {
  const { switches } = await request.json(); if (!Array.isArray(switches)) return NextResponse.json({ error: 'Switches must be an array' }, { status: 400 })
  const pairs = await Promise.all(switches.map(async (sw: { key: string; masterSwitchId?: string }) => [sw.key, sw.masterSwitchId ? (await getApprovedCurves(sw.masterSwitchId)).length > 0 : false] as const))
  return NextResponse.json(Object.fromEntries(pairs))
}
