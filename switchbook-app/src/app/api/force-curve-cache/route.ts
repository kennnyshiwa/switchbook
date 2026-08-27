import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
export async function GET() {
  const switches = await prisma.masterSwitch.findMany({ where: { forceCurveMappings: { some: { state: { in: ['AUTO_APPROVED','MANUALLY_APPROVED'] }, catalogEntry: { exists: true } }, none: { state: 'NO_MATCH' } } }, select: { id: true, name: true, manufacturer: true, updatedAt: true } })
  return NextResponse.json(switches.map(sw => ({ masterSwitchId: sw.id, switchName: sw.name, manufacturer: sw.manufacturer, hasForceCurve: true, lastCheckedAt: sw.updatedAt, nextCheckAt: null })))
}
