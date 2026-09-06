import { NextResponse } from 'next/server'
import { getApprovedCurves } from '@/lib/force-curves'
import { prisma } from '@/lib/prisma'
import { loadSwitchesDBExactInventory } from '@/lib/admin-force-curve-switchesdb-inventory'
import { resolveExactSwitchesDBCurves } from '@/lib/force-curve-switchesdb'

export async function GET(_: Request, { params }: { params: Promise<{ masterSwitchId: string }> }) {
  const { masterSwitchId } = await params
  const curves = await getApprovedCurves(masterSwitchId)
  const inventory = await loadSwitchesDBExactInventory(prisma)
  return NextResponse.json({ curves: resolveExactSwitchesDBCurves(curves, inventory), source: 'canonical-exact' })
}
