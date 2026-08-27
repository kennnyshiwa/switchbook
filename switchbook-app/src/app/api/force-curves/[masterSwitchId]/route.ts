import { NextResponse } from 'next/server'
import { getApprovedCurves } from '@/lib/force-curves'
import { findAllForceCurveMatches } from '@/utils/forceCurves'
import { prisma } from '@/lib/prisma'

export async function GET(_: Request, { params }: { params: Promise<{ masterSwitchId: string }> }) {
  const { masterSwitchId } = await params
  const curves = await getApprovedCurves(masterSwitchId)
  if (curves.length || process.env.FORCE_CURVE_LEGACY_ROLLBACK !== 'true') return NextResponse.json({ curves, source: 'canonical' })
  const sw = await prisma.masterSwitch.findUnique({ where: { id: masterSwitchId }, select: { name: true, manufacturer: true } })
  const legacy = sw ? await findAllForceCurveMatches(sw.name, sw.manufacturer || undefined) : []
  return NextResponse.json({ curves: legacy, source: 'legacy-rollback' })
}
