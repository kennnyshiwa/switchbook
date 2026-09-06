import type { ApprovedCurveRecord } from '@/lib/force-curves'
import type { SwitchesDBExactInventory } from '@/lib/admin-force-curve-switchesdb-inventory'
import { resolveExactSwitchesDBCurves } from '@/lib/force-curve-switchesdb'

export type InitialForceCurve = ReturnType<typeof resolveExactSwitchesDBCurves<ApprovedCurveRecord>>[number]

export function resolveCollectionForceCurves(
  approvedByMasterSwitchId: Record<string, ApprovedCurveRecord[]>,
  inventory: SwitchesDBExactInventory,
) {
  return Object.fromEntries(Object.entries(approvedByMasterSwitchId).map(([masterSwitchId, curves]) => [
    masterSwitchId,
    resolveExactSwitchesDBCurves(curves, inventory),
  ])) as Record<string, InitialForceCurve[]>
}
