import type { PrismaClient } from '@prisma/client'
import { switchesDBThereminGoatKey } from '@/lib/admin-force-curve-switchesdb'

const SWITCHES_DB_METADATA_URL = 'https://switchesdb.switchbook.app/data/metadata.edn'
const THEREMINGOAT_SOURCE = 'github:ThereminGoat/force-curves'
const RAW_SUFFIX = ' Raw Data CSV.csv'
const CACHE_TTL_MS = 5 * 60 * 1000

export type SwitchesDBExactInventory = {
  status: 'ready' | 'unavailable'
  verifiedPaths: ReadonlySet<string>
  collisionPaths: ReadonlySet<string>
}

type InventoryDatabase = Pick<PrismaClient, 'forceCurveCatalogEntry'>
type CachedInventory = { fingerprint: string; loadedAt: number; inventory: SwitchesDBExactInventory }
const inventoryCache = new WeakMap<object, CachedInventory>()

export function switchesDBThereminGoatMetadataKeys(metadata: string) {
  const keys = new Set<string>()
  const entry = /"((?:\\.|[^"\\])*)"\s+\{:source\s+:([a-z]+)\}/g
  for (const match of metadata.matchAll(entry)) {
    if (match[2] !== 'goat') continue
    try {
      keys.add(JSON.parse(`"${match[1]}"`) as string)
    } catch {
      throw new Error('SwitchesDB metadata contains an unsupported key encoding')
    }
  }
  if (!keys.size) throw new Error('SwitchesDB metadata contains no ThereminGoat key inventory')
  return keys
}

/**
 * SwitchesDB metadata identifies generated keys and sources, but not the exact
 * upstream path that produced a key. Combine it with the complete source-path
 * inventory and expose only one-to-one path -> generated-key relationships.
 */
export function buildSwitchesDBExactInventory(repositoryPaths: Iterable<string>, metadata: string): SwitchesDBExactInventory {
  const metadataKeys = switchesDBThereminGoatMetadataKeys(metadata)
  const pathsByKey = new Map<string, Set<string>>()
  for (const repositoryPath of repositoryPaths) {
    const key = switchesDBThereminGoatKey(repositoryPath)
    if (!key) continue
    const paths = pathsByKey.get(key) || new Set<string>()
    paths.add(repositoryPath)
    pathsByKey.set(key, paths)
  }

  const verifiedPaths = new Set<string>()
  const collisionPaths = new Set<string>()
  for (const [key, paths] of pathsByKey) {
    if (paths.size > 1) {
      for (const path of paths) collisionPaths.add(path)
    } else if (metadataKeys.has(key)) {
      verifiedPaths.add(paths.values().next().value as string)
    }
  }
  return { status: 'ready', verifiedPaths, collisionPaths }
}

export function unavailableSwitchesDBInventory(): SwitchesDBExactInventory {
  return { status: 'unavailable', verifiedPaths: new Set(), collisionPaths: new Set() }
}

export async function loadSwitchesDBExactInventory(db: InventoryDatabase): Promise<SwitchesDBExactInventory> {
  try {
    const version = await db.forceCurveCatalogEntry.aggregate({ _count: { _all: true }, _max: { updatedAt: true } })
    const fingerprint = `${version._count._all}:${version._max.updatedAt?.getTime() || 0}`
    const cached = inventoryCache.get(db as object)
    if (cached?.fingerprint === fingerprint && Date.now() - cached.loadedAt < CACHE_TTL_MS) return cached.inventory

    const [entries, response] = await Promise.all([
      db.forceCurveCatalogEntry.findMany({
        where: { source: THEREMINGOAT_SOURCE, exists: true, repositoryPath: { endsWith: RAW_SUFFIX } },
        select: { repositoryPath: true },
      }),
      fetch(SWITCHES_DB_METADATA_URL, { headers: { Accept: 'text/plain' }, cache: 'no-store', signal: AbortSignal.timeout(5_000) }),
    ])
    if (!response.ok) throw new Error(`SwitchesDB metadata failed: ${response.status}`)
    const inventory = buildSwitchesDBExactInventory(entries.map(entry => entry.repositoryPath), await response.text())
    inventoryCache.set(db as object, { fingerprint, loadedAt: Date.now(), inventory })
    return inventory
  } catch {
    return unavailableSwitchesDBInventory()
  }
}
