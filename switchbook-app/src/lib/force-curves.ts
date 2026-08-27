import { ForceCurveMappingState, Prisma, SwitchTechnology } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const FORCE_CURVE_SOURCE = 'github:ThereminGoat/force-curves'
export const APPROVED_STATES: ForceCurveMappingState[] = ['AUTO_APPROVED', 'MANUALLY_APPROVED']
export type CatalogFormat = 'RAW_DATA' | 'HIGH_RESOLUTION_RAW' | 'NONSTANDARD_REVIEW'
export type CatalogInput = { path: string; sha?: string; manufacturer?: string; technology?: SwitchTechnology; metadataVerified?: boolean; format?: CatalogFormat; measurementKey?: string }
export type MatchMaster = { id: string; name: string; manufacturer: string | null; technology: SwitchTechnology | null }
export type MatchCatalog = { id: string; displayName: string; manufacturer: string | null; technology: SwitchTechnology | null; metadataVerifiedAt?: Date | null; exists: boolean }
const normalize = (value?: string | null) => (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function selectAutomaticCandidates(master: MatchMaster, catalog: MatchCatalog[]) {
  // Source metadata is mandatory: unknown manufacturer or technology always fails closed.
  if (!master.manufacturer || !master.technology) return []
  const expected = normalize(`${master.manufacturer} ${master.name}`)
  return catalog.filter(c => c.exists && Boolean(c.metadataVerifiedAt) && Boolean(c.manufacturer) && Boolean(c.technology) && normalize(c.displayName) === expected && normalize(c.manufacturer) === normalize(master.manufacturer) && c.technology === master.technology)
}

export function catalogUrl(path: string) {
  return `https://github.com/ThereminGoat/force-curves/blob/main/${path.split('/').map(encodeURIComponent).join('/')}`
}

type ReadMapping = { state: ForceCurveMappingState; catalogEntry: { id: string; displayName: string; repositoryPath: string; exists: boolean } | null }
export function resolveApprovedCurveRecords(mappings: ReadMapping[]) {
  if (mappings.some(m => m.state === 'NO_MATCH')) return []
  return mappings.filter(m => APPROVED_STATES.includes(m.state) && m.catalogEntry?.exists).flatMap(m => m.catalogEntry ? [{ id: m.catalogEntry.id, folderName: m.catalogEntry.displayName.replace(/\/TG\.csv$/i, ''), path: m.catalogEntry.repositoryPath, url: catalogUrl(m.catalogEntry.repositoryPath), state: m.state }] : [])
}

export async function getApprovedCurves(masterSwitchId: string) {
  const mappings = await prisma.forceCurveMapping.findMany({ where: { masterSwitchId, OR: [{ state: 'NO_MATCH' }, { state: { in: APPROVED_STATES }, catalogEntry: { exists: true } }] }, include: { catalogEntry: true }, orderBy: { catalogEntry: { repositoryPath: 'asc' } } })
  return resolveApprovedCurveRecords(mappings)
}

async function queueReview(masterSwitchId: string, kind: string, reason: string, candidateIds: string[]) {
  const found = await prisma.forceCurveReviewCase.findFirst({ where: { masterSwitchId, kind, status: 'OPEN' } })
  if (found) return false
  await prisma.forceCurveReviewCase.create({ data: { masterSwitchId, kind, reason, payload: { candidateIds } } }); return true
}

async function queueCatalogReview(catalogEntryId: string, kind: string, reason: string, candidateIds: string[], payload: Record<string, unknown>) {
  const found = await prisma.forceCurveReviewCase.findFirst({ where: { catalogEntryId: { in: candidateIds }, kind: { in: ['SOURCE_NONSTANDARD', 'SOURCE_UNVERIFIED'] }, status: 'OPEN' } })
  if (found) {
    await prisma.forceCurveReviewCase.update({ where: { id: found.id }, data: { kind, reason, payload: { candidateIds, ...payload } as Prisma.InputJsonValue } })
    return false
  }
  await prisma.forceCurveReviewCase.create({ data: { catalogEntryId, kind, reason, payload: { candidateIds, ...payload } as Prisma.InputJsonValue } })
  return true
}

export async function syncForceCurveCatalog(revision: string, entries: CatalogInput[], options: { chunkSize?: number; failAfterChunks?: number; catalogRevision?: string } = {}) {
  const chunkSize = options.chunkSize || 50
  const uniqueEntries = [...new Map(entries.map(e => [e.path, e])).values()].sort((a,b) => a.path.localeCompare(b.path))
  let run = await prisma.forceCurveSyncRun.upsert({ where: { source_revision: { source: FORCE_CURVE_SOURCE, revision } }, create: { source: FORCE_CURVE_SOURCE, revision, beforeCount: await prisma.forceCurveCatalogEntry.count({ where: { source: FORCE_CURVE_SOURCE, exists: true } }) }, update: {} })
  if (run.status === 'COMPLETED') return run
  const start = Number(run.cursor || 0)
  try {
    let completedChunks = 0
    for (let offset = start; offset < uniqueEntries.length; offset += chunkSize) {
      const chunk = uniqueEntries.slice(offset, offset + chunkSize)
      await prisma.$transaction(async tx => {
        let added = 0, changed = 0, staled = 0
        for (const entry of chunk) {
          const previous = await tx.forceCurveCatalogEntry.findUnique({ where: { source_repositoryPath: { source: FORCE_CURVE_SOURCE, repositoryPath: entry.path } } })
          const displayName = measurementDisplayName(entry.path)
          const contentChanged = Boolean(previous && previous.contentHash !== (entry.sha || null))
          const catalogRevision = options.catalogRevision || revision
          const trustedMetadata = entry.metadataVerified && entry.manufacturer && entry.technology ? { manufacturer: entry.manufacturer, technology: entry.technology, metadataVerifiedAt: new Date() } : {}
          const row = await tx.forceCurveCatalogEntry.upsert({ where: { source_repositoryPath: { source: FORCE_CURVE_SOURCE, repositoryPath: entry.path } }, create: { source: FORCE_CURVE_SOURCE, repositoryPath: entry.path, displayName, revision: catalogRevision, contentHash: entry.sha, ...trustedMetadata }, update: { displayName, revision: catalogRevision, contentHash: entry.sha, ...(!previous?.metadataVerifiedAt ? trustedMetadata : {}), exists: true, lastSeenAt: new Date() } })
          if (!previous) added++; else if (contentChanged || !previous.exists) changed++
          if (contentChanged) staled += (await tx.forceCurveMapping.updateMany({ where: { catalogEntryId: row.id, state: { in: APPROVED_STATES } }, data: { state: 'STALE', reason: 'Curve content hash changed' } })).count
        }
        await tx.forceCurveSyncRun.update({ where: { id: run.id }, data: { status: 'RUNNING', cursor: String(Math.min(offset + chunk.length, uniqueEntries.length)), newCount: { increment: added }, changedCount: { increment: changed }, staleCount: { increment: staled } } })
      })
      completedChunks++
      if (options.failAfterChunks && completedChunks >= options.failAfterChunks) throw new Error('Injected sync interruption')
    }
    const paths = uniqueEntries.map(e => e.path)
    const missing = await prisma.forceCurveCatalogEntry.findMany({ where: { source: FORCE_CURVE_SOURCE, exists: true, repositoryPath: { notIn: paths } }, select: { id: true } })
    if (missing.length) await prisma.$transaction(async tx => {
      await tx.forceCurveCatalogEntry.updateMany({ where: { id: { in: missing.map(x => x.id) } }, data: { exists: false } })
      const stale = await tx.forceCurveMapping.updateMany({ where: { catalogEntryId: { in: missing.map(x => x.id) }, state: { in: APPROVED_STATES } }, data: { state: 'STALE', reason: 'Catalog path disappeared upstream' } })
      await tx.forceCurveSyncRun.update({ where: { id: run.id }, data: { staleCount: { increment: stale.count } } })
    })
    let unmatched = 0, reviews = 0
    // Reconcile queue noise created by the retired empty-catalog matcher. This is
    // an audited state transition, not deletion, and is safe to repeat.
    await prisma.forceCurveReviewCase.updateMany({ where: { kind: 'UNMATCHED', status: 'OPEN', createdAt: { lt: run.startedAt } }, data: { status: 'RESOLVED', resolution: 'NO_MATCH', resolvedAt: new Date(), reason: 'Reconciled: superseded by source-centric catalog review' } })
    const catalog = await prisma.forceCurveCatalogEntry.findMany({ where: { source: FORCE_CURVE_SOURCE, exists: true } })
    const catalogByPath = new Map(catalog.map(entry => [entry.repositoryPath, entry]))
    const groups = new Map<string, CatalogInput[]>()
    for (const entry of uniqueEntries) {
      const key = entry.measurementKey || entry.path
      groups.set(key, [...(groups.get(key) || []), entry])
    }
    for (const [measurementKey, members] of groups) {
      const rows = members.map(member => catalogByPath.get(member.path)).filter((row): row is NonNullable<typeof row> => Boolean(row))
      if (!rows.length || rows.some(row => row.metadataVerifiedAt)) continue
      const ordered = [...members].sort((a, b) => formatPriority(a.format) - formatPriority(b.format) || a.path.localeCompare(b.path))
      const candidateIds = ordered.map(member => catalogByPath.get(member.path)?.id).filter((id): id is string => Boolean(id))
      const hasNonstandard = members.some(member => member.format === 'NONSTANDARD_REVIEW')
      if (await queueCatalogReview(candidateIds[0], hasNonstandard ? 'SOURCE_NONSTANDARD' : 'SOURCE_UNVERIFIED', hasNonstandard ? 'Nonstandard CSV requires format and identity review' : 'Source has no authoritative manufacturer or technology metadata', candidateIds, { measurementKey, paths: ordered.map(member => member.path), preferredCatalogEntryId: candidateIds[0] })) reviews++
    }
    const masters = await prisma.masterSwitch.findMany({ where: { status: 'APPROVED' }, select: { id: true, name: true, manufacturer: true, technology: true } })
    for (const master of masters) {
      const noMatch = await prisma.forceCurveMapping.findFirst({ where: { masterSwitchId: master.id, state: 'NO_MATCH' } }); if (noMatch) continue
      const candidates = selectAutomaticCandidates(master, catalog)
      if (candidates.length === 1) {
        const decision = await prisma.forceCurveMapping.findFirst({ where: { masterSwitchId: master.id, catalogEntryId: candidates[0].id } })
        if (decision?.state === 'MANUALLY_APPROVED' || decision?.state === 'REJECTED') continue
        if (decision?.state === 'STALE') { if (await queueReview(master.id, 'STALE', 'Changed curve requires explicit re-verification', [candidates[0].id])) reviews++; continue }
        await prisma.forceCurveMapping.upsert({ where: { masterSwitchId_catalogEntryId: { masterSwitchId: master.id, catalogEntryId: candidates[0].id } }, create: { masterSwitchId: master.id, catalogEntryId: candidates[0].id, state: 'AUTO_APPROVED', confidence: 1, provenance: `sync:${run.id}` }, update: { state: 'AUTO_APPROVED', confidence: 1, provenance: `sync:${run.id}` } })
      } else if (candidates.length > 1) { unmatched++; if (await queueReview(master.id, 'AMBIGUOUS', 'Multiple verified compatible exact paths', candidates.map(c => c.id))) reviews++ }
      else unmatched++
    }
    const peach = await prisma.masterSwitch.findUnique({ where: { id: 'cmqo21sm103vknu3vh0tjs75x' }, select: { id: true } })
    if (peach) {
      await prisma.forceCurveMapping.updateMany({ where: { masterSwitchId: peach.id, state: { in: APPROVED_STATES } }, data: { state: 'STALE', reason: 'No verified KTT Peach Blossom curve' } })
      await prisma.forceCurveMapping.upsert({ where: { noMatchKey: peach.id }, create: { masterSwitchId: peach.id, noMatchKey: peach.id, state: 'NO_MATCH', provenance: 'regression-guard', reason: 'No verified KTT Peach Blossom curve' }, update: { state: 'NO_MATCH', provenance: 'regression-guard' } })
    }
    run = await prisma.forceCurveSyncRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', completedAt: new Date(), cursor: String(uniqueEntries.length), afterCount: await prisma.forceCurveCatalogEntry.count({ where: { source: FORCE_CURVE_SOURCE, exists: true } }), unmatchedCount: unmatched, reviewCount: reviews } }); return run
  } catch (error) {
    const current = await prisma.forceCurveSyncRun.findUniqueOrThrow({ where: { id: run.id } }); const prior = Array.isArray(current.errors) ? current.errors : []
    await prisma.forceCurveSyncRun.update({ where: { id: run.id }, data: { status: 'FAILED', errorCount: { increment: 1 }, errors: [...prior, { message: error instanceof Error ? error.message : String(error), cursor: current.cursor }] as Prisma.InputJsonValue } }); throw error
  }
}

export async function fetchThereminGoatCatalog() {
  const response = await fetch('https://api.github.com/repos/ThereminGoat/force-curves/git/trees/main?recursive=1', { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Switchbook-App', ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}) } })
  if (!response.ok) throw new Error(`GitHub catalog failed: ${response.status}`)
  const data = await response.json() as { sha: string; tree: Array<{ path: string; type: string; sha: string }>; truncated: boolean }; if (data.truncated) throw new Error('GitHub recursive tree was truncated')
  return { revision: data.sha, entries: classifyCatalogTree(data.tree) }
}

const RAW_SUFFIX = ' Raw Data CSV.csv'
const HIGH_RES_SUFFIX = '_HighResolutionRaw.csv'
// Exact legacy switch-curve exceptions observed at the audited upstream
// revision. Generic CSV discovery is intentionally forbidden.
const REVIEW_ONLY_LEGACY_PATHS = new Set([
  'BSUN Avocado Panda V2/BSUN Avocado Panda V2.csv',
  'BSUN Crystal Light Blue/BSUN Crystal Light Blue.csv',
  'Domikey x Glove Chocolate Donut Pink/Domikey x Glove Chocolate Donut Pink Raw Data CSv.csv',
  'Gateron Full POM Strawberry Smoothie/Gateron Full POM Strawberry Smoothie.csv',
  'Huano Pineapple/Huano Pineapple 51000 Actuations Ra w Data CSV.csv',
  'Kailh Pro Heavy Plum (PCB Mount)/Kailh Pro Heavy Plum (PCB Mount) Raw Data.csv',
  'KeyGeek Raw/KeyGeek Raw Raw CSV.csv',
  'LCET Sea Night/LCET Sea Night Data CSV.csv',
  'MOD-M Linear/MOD-M Linear Raw Data.csv',
  'MODE Tomorrow Purple Prototype/MODE_Tomorrow_Purple_Prototype_HighResolution.csv',
  'Mekanisk Ultramarine V2/Mekanisk_Ultramarine_V2_HighResoultionRaw.csv',
  'PantheonKeys x TTC PT Black/PantheonKeys x TTC PT Black 51000 Actuations.csv',
])

function isNonSwitchArtifact(path: string) {
  if (!path.toLowerCase().endsWith('.csv')) return false
  const normalized = path.toLowerCase().replace(/[_-]+/g, ' ')
  const file = normalized.slice(normalized.lastIndexOf('/') + 1)
  // A switch name may legitimately contain "spring". Exclude only paths that
  // identify a spring tester/test directory, plus construction work products.
  return (/spring[^/]*test|test[^/]*spring/.test(normalized) || /\bconstruction\b/.test(file))
}

export function measurementDisplayName(path: string) {
  const file = path.slice(path.lastIndexOf('/') + 1)
  if (/^TG\.csv$/i.test(file)) return path.includes('/') ? path.slice(0, path.lastIndexOf('/')).split('/').at(-1)! : 'TG'
  const stem = file.endsWith(RAW_SUFFIX) ? file.slice(0, -RAW_SUFFIX.length) : file.endsWith(HIGH_RES_SUFFIX) ? file.slice(0, -HIGH_RES_SUFFIX.length).replace(/_/g, ' ') : file.replace(/\.csv$/i, '')
  return stem.replace(/\s+/g, ' ').trim()
}

function measurementKey(path: string) {
  const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
  return `${parent}/${normalize(measurementDisplayName(path))}`
}

function formatPriority(format?: CatalogFormat) { return format === 'HIGH_RESOLUTION_RAW' ? 0 : format === 'RAW_DATA' ? 1 : 2 }

export function classifyCatalogTree(tree: Array<{ path: string; type: string; sha: string }>): CatalogInput[] {
  return tree.filter(entry => entry.type === 'blob' && !isNonSwitchArtifact(entry.path) && (entry.path.endsWith(RAW_SUFFIX) || entry.path.endsWith(HIGH_RES_SUFFIX) || REVIEW_ONLY_LEGACY_PATHS.has(entry.path))).map(entry => {
    const format: CatalogFormat = entry.path.endsWith(RAW_SUFFIX) ? 'RAW_DATA' : entry.path.endsWith(HIGH_RES_SUFFIX) ? 'HIGH_RESOLUTION_RAW' : 'NONSTANDARD_REVIEW'
    return { path: entry.path, sha: entry.sha, format, measurementKey: measurementKey(entry.path) }
  })
}
