import type { SwitchesDBExactInventory } from '@/lib/admin-force-curve-switchesdb-inventory'
import { resolveSwitchesDBMeasurement } from '@/lib/admin-force-curve-switchesdb'

const RAW_SUFFIX = ' Raw Data CSV.csv'
const HIGH_RESOLUTION_SUFFIX = '_HighResolutionRaw.csv'

type ApprovedCurve = {
  id: string
  source?: string
  folderName: string
  path: string
  url: string
}

function exactInventoryState(repositoryPath: string, inventory: SwitchesDBExactInventory) {
  return inventory.collisionPaths.has(repositoryPath)
    ? 'collision' as const
    : inventory.verifiedPaths.has(repositoryPath)
      ? 'verified' as const
      : 'unavailable' as const
}

function rawSiblingPath(repositoryPath: string) {
  if (repositoryPath.endsWith(RAW_SUFFIX)) return repositoryPath
  if (!repositoryPath.endsWith(HIGH_RESOLUTION_SUFFIX)) return null
  const slash = repositoryPath.lastIndexOf('/')
  if (slash < 1) return null
  const stem = repositoryPath.slice(slash + 1, -HIGH_RESOLUTION_SUFFIX.length).replace(/_/g, ' ')
  return stem ? `${repositoryPath.slice(0, slash + 1)}${stem}${RAW_SUFFIX}` : null
}

/**
 * Project canonical approvals to SwitchesDB only when every approval has one
 * distinct, inventory-verified exact measurement. A partial projection could
 * silently hide a tied, missing, colliding, or unsafe approval, so any such
 * result fails the entire control closed.
 */
export function resolveExactSwitchesDBCurves<T extends ApprovedCurve>(curves: T[], inventory: SwitchesDBExactInventory) {
  if (inventory.status !== 'ready') return []

  const resolvedCurves: Array<T & { measurementId: string; sourceUrl: string }> = []
  const identities = new Set<string>()
  const catalogEntries = new Map<string, { source: string; path: string }>()

  for (const curve of curves) {
    const source = curve.source || ''
    const prior = catalogEntries.get(curve.id)
    if (prior && (prior.source !== source || prior.path !== curve.path)) return []
    catalogEntries.set(curve.id, { source, path: curve.path })

    const rawPath = rawSiblingPath(curve.path)
    if (!rawPath) return []
    const primary = { id: curve.id, source, displayName: curve.folderName, repositoryPath: curve.path }
    const raw = {
      id: rawPath === curve.path ? curve.id : `${curve.id}:raw`,
      source,
      displayName: curve.folderName,
      repositoryPath: rawPath,
      switchesDBExact: exactInventoryState(rawPath, inventory),
    }
    const resolved = resolveSwitchesDBMeasurement([primary, raw], curve.id)
    if (!resolved.available) return []

    const measurementId = `${source}:${resolved.repositoryPath}`
    if (identities.has(measurementId)) return []
    identities.add(measurementId)
    resolvedCurves.push({ ...curve, url: resolved.url, sourceUrl: curve.url, measurementId })
  }

  return resolvedCurves
}
