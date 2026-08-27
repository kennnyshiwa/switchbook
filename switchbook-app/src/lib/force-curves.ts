import { ForceCurveMappingState, Prisma, SwitchTechnology } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const FORCE_CURVE_SOURCE = 'github:ThereminGoat/force-curves'
export const APPROVED_STATES: ForceCurveMappingState[] = ['AUTO_APPROVED', 'MANUALLY_APPROVED']
export type CatalogInput = { path: string; sha?: string; manufacturer?: string; technology?: SwitchTechnology }
export type MatchMaster = { id: string; name: string; manufacturer: string | null; technology: SwitchTechnology | null }
export type MatchCatalog = { id: string; displayName: string; manufacturer: string | null; technology: SwitchTechnology | null; exists: boolean }
const normalize = (value?: string | null) => (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function selectAutomaticCandidates(master: MatchMaster, catalog: MatchCatalog[]) {
  // Source metadata is mandatory: unknown manufacturer or technology always fails closed.
  if (!master.manufacturer || !master.technology) return []
  const expected = normalize(`${master.manufacturer} ${master.name}`)
  return catalog.filter(c => c.exists && Boolean(c.manufacturer) && Boolean(c.technology) && normalize(c.displayName.replace(/\/TG\.csv$/i, '')) === expected && normalize(c.manufacturer) === normalize(master.manufacturer) && c.technology === master.technology)
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

export async function syncForceCurveCatalog(revision: string, entries: CatalogInput[], options: { chunkSize?: number; failAfterChunks?: number } = {}) {
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
          const displayName = entry.path.replace(/\/TG\.csv$/i, '')
          const contentChanged = Boolean(previous && previous.contentHash !== (entry.sha || null))
          const row = await tx.forceCurveCatalogEntry.upsert({ where: { source_repositoryPath: { source: FORCE_CURVE_SOURCE, repositoryPath: entry.path } }, create: { source: FORCE_CURVE_SOURCE, repositoryPath: entry.path, displayName, revision, contentHash: entry.sha, manufacturer: entry.manufacturer, technology: entry.technology }, update: { displayName, revision, contentHash: entry.sha, manufacturer: entry.manufacturer, technology: entry.technology, exists: true, lastSeenAt: new Date() } })
          if (!previous) added++; else if (contentChanged || !previous.exists) changed++
          if (contentChanged) staled += (await tx.forceCurveMapping.updateMany({ where: { catalogEntryId: row.id, state: 'AUTO_APPROVED' }, data: { state: 'STALE', reason: 'Curve content hash changed' } })).count
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
    const masters = await prisma.masterSwitch.findMany({ where: { status: 'APPROVED' }, select: { id: true, name: true, manufacturer: true, technology: true } })
    const catalog = await prisma.forceCurveCatalogEntry.findMany({ where: { source: FORCE_CURVE_SOURCE, exists: true } })
    for (const master of masters) {
      const noMatch = await prisma.forceCurveMapping.findFirst({ where: { masterSwitchId: master.id, state: 'NO_MATCH' } }); if (noMatch) continue
      const candidates = selectAutomaticCandidates(master, catalog)
      if (candidates.length === 1) {
        const stale = await prisma.forceCurveMapping.findFirst({ where: { masterSwitchId: master.id, catalogEntryId: candidates[0].id, state: 'STALE' } })
        if (stale) { if (await queueReview(master.id, 'STALE', 'Changed curve requires explicit re-verification', [candidates[0].id])) reviews++; continue }
        const rejected = await prisma.forceCurveMapping.findFirst({ where: { masterSwitchId: master.id, catalogEntryId: candidates[0].id, state: 'REJECTED' } }); if (rejected) continue
        await prisma.forceCurveMapping.upsert({ where: { masterSwitchId_catalogEntryId: { masterSwitchId: master.id, catalogEntryId: candidates[0].id } }, create: { masterSwitchId: master.id, catalogEntryId: candidates[0].id, state: 'AUTO_APPROVED', confidence: 1, provenance: `sync:${run.id}` }, update: { state: 'AUTO_APPROVED', confidence: 1, provenance: `sync:${run.id}` } })
      } else { unmatched++; if (await queueReview(master.id, candidates.length > 1 ? 'AMBIGUOUS' : 'UNMATCHED', candidates.length > 1 ? 'Multiple compatible exact paths' : 'No uniquely compatible exact path', candidates.map(c => c.id))) reviews++ }
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
  // Exact file identity is retained. Metadata is intentionally absent until supplied by a trusted manifest/reviewer, so auto-matching fails closed.
  return { revision: data.sha, entries: data.tree.filter(x => x.type === 'blob' && /(^|\/)TG\.csv$/i.test(x.path)).map(x => ({ path: x.path, sha: x.sha })) }
}
