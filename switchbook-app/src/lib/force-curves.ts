import { ForceCurveMappingState, Prisma, SwitchTechnology } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export const FORCE_CURVE_SOURCE = 'github:ThereminGoat/force-curves'
export const FORCE_CURVE_SYNC_ALGORITHM = 'formats-v3:exact-match-v1'
export const forceCurveSyncRevision = (catalogRevision: string) => `${catalogRevision}:${FORCE_CURVE_SYNC_ALGORITHM}`
export const APPROVED_STATES: ForceCurveMappingState[] = ['AUTO_APPROVED', 'MANUALLY_APPROVED']
export type CatalogFormat = 'RAW_DATA' | 'HIGH_RESOLUTION_RAW' | 'NONSTANDARD_REVIEW'
export type CatalogInput = { path: string; sha?: string; manufacturer?: string; technology?: SwitchTechnology; metadataVerified?: boolean; format?: CatalogFormat; measurementKey?: string }
export type MatchMaster = { id: string; name: string; manufacturer: string | null; technology: SwitchTechnology | null }
export type MatchCatalog = { id: string; displayName: string; repositoryPath?: string; contentHash?: string | null; manufacturer: string | null; technology: SwitchTechnology | null; metadataVerifiedAt?: Date | null; exists: boolean }
const normalize = (value?: string | null) => (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
function syncRunFromProvenance(value: string) {
  try {
    const parsed = JSON.parse(value) as { syncRunId?: unknown }
    return typeof parsed.syncRunId === 'string' ? parsed.syncRunId : null
  } catch { return null }
}

export function normalizedMasterIdentity(master: MatchMaster) {
  if (!master.manufacturer) return ''
  const manufacturer = normalize(master.manufacturer)
  const name = normalize(master.name)
  return name === manufacturer || name.startsWith(`${manufacturer} `) ? name : `${manufacturer} ${name}`
}

function hasPathEvidence(candidate: MatchCatalog) {
  if (!candidate.repositoryPath || !candidate.contentHash) return false
  const parent = candidate.repositoryPath.split('/').at(-2)
  const standard = candidate.repositoryPath.endsWith(RAW_SUFFIX) || candidate.repositoryPath.endsWith(HIGH_RES_SUFFIX)
  return standard && Boolean(parent) && normalize(parent) === normalize(candidate.displayName)
}

export function selectAutomaticCandidates(master: MatchMaster, catalog: MatchCatalog[]) {
  const expected = normalizedMasterIdentity(master)
  if (!expected) return []
  return catalog.filter(c => c.exists && hasPathEvidence(c) && normalize(c.displayName) === expected
    && (!c.manufacturer || normalize(c.manufacturer) === normalize(master.manufacturer))
    && (!c.technology || !master.technology || c.technology === master.technology))
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

export async function syncForceCurveCatalog(revision: string, entries: CatalogInput[], options: { chunkSize?: number; failAfterChunks?: number; failAfterReconcileChunks?: number; catalogRevision?: string } = {}) {
  const chunkSize = options.chunkSize || 50
  const uniqueEntries = [...new Map(entries.map(e => [e.path, e])).values()].sort((a,b) => a.path.localeCompare(b.path))
  const catalogRevision = options.catalogRevision || revision
  // Creation is the ownership claim. A concurrent caller that loses the unique
  // (source, revision) insert waits for the owner and shares its durable result.
  // FAILED runs are claimed with a compare-and-set; an abruptly abandoned RUNNING
  // run may only be reclaimed after an hour without a heartbeat.
  let ownsRun = false
  let run: Awaited<ReturnType<typeof prisma.forceCurveSyncRun.findUniqueOrThrow>>
  try {
    run = await prisma.forceCurveSyncRun.create({ data: { source: FORCE_CURVE_SOURCE, revision, beforeCount: await prisma.forceCurveCatalogEntry.count({ where: { source: FORCE_CURVE_SOURCE, exists: true } }) } })
    ownsRun = true
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    run = await prisma.forceCurveSyncRun.findUniqueOrThrow({ where: { source_revision: { source: FORCE_CURVE_SOURCE, revision } } })
  }
  while (!ownsRun && run.status !== 'COMPLETED') {
    if (run.status === 'FAILED') {
      const claimed = await prisma.forceCurveSyncRun.updateMany({ where: { id: run.id, status: 'FAILED', updatedAt: run.updatedAt }, data: { status: 'RUNNING', completedAt: null } })
      ownsRun = claimed.count === 1
    } else if (run.updatedAt < new Date(Date.now() - 60 * 60 * 1000)) {
      const abandoned = await prisma.forceCurveSyncRun.updateMany({ where: { id: run.id, status: 'RUNNING', updatedAt: run.updatedAt }, data: { status: 'FAILED' } })
      if (abandoned.count === 1) continue
    }
    if (!ownsRun) {
      await new Promise(resolve => setTimeout(resolve, 100))
      run = await prisma.forceCurveSyncRun.findUniqueOrThrow({ where: { id: run.id } })
    }
  }
  if (!ownsRun) return reconcileCompletedSyncRun(run.id, catalogRevision)
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
    let unmatched = 0
    const catalog = await prisma.forceCurveCatalogEntry.findMany({ where: { source: FORCE_CURVE_SOURCE, exists: true } })
    const catalogByPath = new Map(catalog.map(entry => [entry.repositoryPath, entry]))
    const groups = new Map<string, CatalogInput[]>()
    for (const entry of uniqueEntries) {
      const key = entry.measurementKey || entry.path
      groups.set(key, [...(groups.get(key) || []), entry])
    }
    const [masters, manufacturers] = await Promise.all([
      prisma.masterSwitch.findMany({ where: { status: 'APPROVED' }, select: { id: true, name: true, manufacturer: true, technology: true } }),
      prisma.manufacturer.findMany({ where: { verified: true }, select: { name: true, aliases: true } }),
    ])
    const decisions = await prisma.forceCurveMapping.findMany({ select: { masterSwitchId: true, catalogEntryId: true, state: true, provenance: true } })
    const decided = new Map(decisions.filter(item => item.catalogEntryId).map(item => [`${item.masterSwitchId}:${item.catalogEntryId}`, item]))
    const noMatch = new Set(decisions.filter(item => item.state === 'NO_MATCH').map(item => item.masterSwitchId))
    const makerTokens = manufacturers.flatMap(maker => [maker.name, ...maker.aliases].map(token => ({ token: normalize(token), canonical: maker.name }))).filter(x => x.token)
    const resolveMaker = (identity: string) => {
      const hits = new Set(makerTokens.filter(x => identity === x.token || identity.startsWith(`${x.token} `)).map(x => x.canonical))
      return hits.size === 1 ? [...hits][0] : null
    }
    const reconcileGroups = [...groups.entries()]
    let reconcileChunks = 0
    for (let offset = 0; offset < reconcileGroups.length; offset += chunkSize) {
      const groupChunk = reconcileGroups.slice(offset, offset + chunkSize)
      const staged: Prisma.ForceCurveSyncStageCreateManyInput[] = []
      const stageReview = (outputKey: string, kind: string, reason: string, rows: typeof catalog, measurementKey: string, masterSwitchId?: string, payload?: Prisma.InputJsonValue) => {
        const candidateIds = rows.map(row => row.id).sort()
        staged.push({ runId: run.id, outputKey, outputType: 'REVIEW', masterSwitchId, catalogEntryId: candidateIds[0], reviewKind: kind, reason, payload: payload || { measurementKey, candidateIds } })
      }
      for (const [measurementKey, members] of groupChunk) {
        const rows = members.map(member => catalogByPath.get(member.path)).filter((row): row is NonNullable<typeof row> => Boolean(row))
        if (!rows.length) continue
        if (!rows.some(row => row.metadataVerifiedAt)) {
          const ordered = [...members].sort((a, b) => formatPriority(a.format) - formatPriority(b.format) || a.path.localeCompare(b.path))
          const candidateIds = ordered.map(member => catalogByPath.get(member.path)?.id).filter((id): id is string => Boolean(id))
          const nonstandard = members.some(member => member.format === 'NONSTANDARD_REVIEW')
          stageReview(`source:${measurementKey}`, nonstandard ? 'SOURCE_NONSTANDARD' : 'SOURCE_UNVERIFIED', nonstandard ? 'Nonstandard CSV requires format and identity review' : 'Source has no authoritative manufacturer or technology metadata', rows, measurementKey, undefined, { measurementKey, paths: ordered.map(member => member.path), candidateIds, preferredCatalogEntryId: candidateIds[0] })
        }
        if (members.some(member => member.format === 'NONSTANDARD_REVIEW')) continue
        const identity = normalize(rows[0]?.displayName)
        if (!identity || rows.some(row => normalize(row.displayName) !== identity)) { stageReview(`group:identity:${measurementKey}`, 'IDENTITY_CONFLICT', 'Catalog paths in one measurement disagree on switch identity', rows, measurementKey); continue }
        const canonicalMaker = resolveMaker(identity)
        if (!canonicalMaker) { stageReview(`group:maker:${measurementKey}`, 'MANUFACTURER_CONFLICT', 'Manufacturer prefix does not resolve to one verified canonical manufacturer', rows, measurementKey); continue }
        const eligibleMasters = masters.filter(master => {
          const masterMaker = manufacturers.find(maker => normalize(maker.name) === normalize(master.manufacturer) || maker.aliases.some(alias => normalize(alias) === normalize(master.manufacturer)))
          return masterMaker?.name === canonicalMaker && normalizedMasterIdentity({ ...master, manufacturer: canonicalMaker }) === identity
        })
        if (eligibleMasters.length !== 1) {
          unmatched++
          stageReview(`group:ambiguous:${measurementKey}`, 'AMBIGUOUS', 'Exact identity does not resolve to one approved master switch', rows, measurementKey)
          continue
        }
        const master = eligibleMasters[0]
        if (noMatch.has(master.id)) continue
        if (rows.some(row => row.technology && master.technology && row.technology !== master.technology)) { stageReview(`group:technology:${measurementKey}`, 'TECHNOLOGY_CONFLICT', 'Known catalog technology conflicts with the exact master switch', rows, measurementKey, master.id); continue }
        const compatible = selectAutomaticCandidates({ ...master, manufacturer: canonicalMaker }, rows)
        const collapsed = collapseAutomaticCandidates(compatible)
        if (collapsed.length !== 1) { stageReview(`group:evidence:${measurementKey}`, 'INSUFFICIENT_EVIDENCE', 'Exact candidate lacks compatible standard path or content evidence', rows, measurementKey, master.id); continue }
        const preferredFormat = collapsed[0].repositoryPath!.endsWith(HIGH_RES_SUFFIX) ? 'HIGH_RESOLUTION_RAW' : 'RAW_DATA'
        const samePriority = compatible.filter(row => (row.repositoryPath!.endsWith(HIGH_RES_SUFFIX) ? 'HIGH_RESOLUTION_RAW' : 'RAW_DATA') === preferredFormat)
        if (samePriority.length !== 1) { stageReview(`group:equal:${measurementKey}`, 'AMBIGUOUS', 'Multiple equal-priority exact catalog candidates', rows, measurementKey, master.id); continue }
        const candidate = collapsed[0]
        const provenance = JSON.stringify({ source: FORCE_CURVE_SOURCE, revision: catalogRevision, syncRunId: run.id, rule: 'exact-path-identity-v1', measurementKey, manufacturer: canonicalMaker, contentHash: candidate.contentHash })
        const priorDecision = decided.get(`${master.id}:${candidate.id}`)
        const adoptedLegacyStage = priorDecision?.state === 'REVIEW_REQUIRED' && syncRunFromProvenance(priorDecision.provenance) === run.id
        if (!priorDecision || adoptedLegacyStage) staged.push({ runId: run.id, outputKey: `mapping:${master.id}:${candidate.id}`, outputType: 'MAPPING', masterSwitchId: master.id, catalogEntryId: candidate.id, mappingState: 'AUTO_APPROVED', confidence: 1, provenance })
      }
      if (staged.length) await prisma.forceCurveSyncStage.createMany({ data: staged, skipDuplicates: true })
      reconcileChunks++
      if (options.failAfterReconcileChunks && reconcileChunks >= options.failAfterReconcileChunks) throw new Error('Injected reconciliation interruption')
    }
    if (options.failAfterReconcileChunks === 0) throw new Error('Injected pre-publish interruption')
    run = await prisma.$transaction(async tx => {
      await tx.$executeRaw`INSERT INTO "ForceCurveMapping" ("id", "masterSwitchId", "catalogEntryId", "state", "confidence", "provenance", "createdAt", "updatedAt") SELECT s."id", s."masterSwitchId", s."catalogEntryId", 'AUTO_APPROVED'::"ForceCurveMappingState", s."confidence", s."provenance", NOW(), NOW() FROM "ForceCurveSyncStage" s WHERE s."runId" = ${run.id} AND s."outputType" = 'MAPPING' ON CONFLICT ("masterSwitchId", "catalogEntryId") DO NOTHING`
      await tx.$executeRaw`UPDATE "ForceCurveMapping" SET "state" = 'AUTO_APPROVED'::"ForceCurveMappingState", "updatedAt" = NOW() WHERE "state" = 'REVIEW_REQUIRED'::"ForceCurveMappingState" AND "provenance" LIKE ${`%\"syncRunId\":\"${run.id}\"%`}`
      await tx.$executeRaw`INSERT INTO "ForceCurveReviewCase" ("id", "masterSwitchId", "catalogEntryId", "kind", "status", "reason", "payload", "createdAt", "updatedAt") SELECT s."id", s."masterSwitchId", s."catalogEntryId", s."reviewKind", 'OPEN'::"ForceCurveReviewStatus", s."reason", s."payload", NOW(), NOW() FROM "ForceCurveSyncStage" s WHERE s."runId" = ${run.id} AND s."outputType" = 'REVIEW' AND NOT EXISTS (SELECT 1 FROM "ForceCurveReviewCase" r WHERE r."status" = 'OPEN'::"ForceCurveReviewStatus" AND r."kind" = s."reviewKind" AND r."catalogEntryId" = s."catalogEntryId" AND r."masterSwitchId" IS NOT DISTINCT FROM s."masterSwitchId") ON CONFLICT ("id") DO NOTHING`
      await tx.$executeRaw`UPDATE "ForceCurveReviewCase" r SET "status" = 'RESOLVED'::"ForceCurveReviewStatus", "resolution" = 'AUTO_APPROVED'::"ForceCurveMappingState", "resolvedAt" = NOW(), "reason" = 'Automatically resolved by exact path identity rule', "updatedAt" = NOW() WHERE r."status" = 'OPEN'::"ForceCurveReviewStatus" AND r."kind" IN ('SOURCE_UNVERIFIED', 'SOURCE_NONSTANDARD') AND EXISTS (SELECT 1 FROM "ForceCurveSyncStage" s WHERE s."runId" = ${run.id} AND s."outputType" = 'MAPPING' AND s."catalogEntryId" = r."catalogEntryId")`
      await tx.forceCurveReviewCase.updateMany({ where: { kind: 'UNMATCHED', status: 'OPEN', createdAt: { lt: run.startedAt } }, data: { status: 'RESOLVED', resolution: 'NO_MATCH', resolvedAt: new Date(), reason: 'Reconciled: superseded by source-centric catalog review' } })
      const peach = await tx.masterSwitch.findUnique({ where: { id: 'cmqo21sm103vknu3vh0tjs75x' }, select: { id: true } })
      if (peach && !await tx.forceCurveMapping.findFirst({ where: { masterSwitchId: peach.id, state: 'NO_MATCH' } })) await tx.forceCurveMapping.create({ data: { masterSwitchId: peach.id, noMatchKey: peach.id, state: 'NO_MATCH', provenance: 'regression-guard', reason: 'No verified KTT Peach Blossom curve' } })
      const [afterCount, reviewCount] = await Promise.all([
        tx.forceCurveCatalogEntry.count({ where: { source: FORCE_CURVE_SOURCE, exists: true } }),
        applicableReviewCount(tx, catalogRevision),
      ])
      return tx.forceCurveSyncRun.update({ where: { id: run.id }, data: { status: 'COMPLETED', completedAt: new Date(), cursor: String(uniqueEntries.length), afterCount, unmatchedCount: unmatched, reviewCount } })
    }); return run
  } catch (error) {
    await prisma.$transaction(async tx => {
      const current = await tx.forceCurveSyncRun.findUniqueOrThrow({ where: { id: run.id } }); const prior = Array.isArray(current.errors) ? current.errors : []
      await tx.forceCurveSyncRun.update({ where: { id: run.id }, data: { status: 'FAILED', errorCount: { increment: 1 }, errors: [...prior, { message: error instanceof Error ? error.message : String(error), cursor: current.cursor }] as Prisma.InputJsonValue } })
    }); throw error
  }
}

type ForceCurveTx = Prisma.TransactionClient
function applicableReviewCount(tx: ForceCurveTx, catalogRevision: string) {
  return tx.forceCurveReviewCase.count({ where: {
    status: 'OPEN',
    kind: { in: ['SOURCE_UNVERIFIED', 'SOURCE_NONSTANDARD'] },
    catalogEntry: { source: FORCE_CURVE_SOURCE, exists: true, revision: catalogRevision },
  } })
}

async function reconcileCompletedSyncRun(runId: string, catalogRevision: string) {
  return prisma.$transaction(async tx => {
    const current = await tx.forceCurveSyncRun.findUniqueOrThrow({ where: { id: runId } })
    if (current.status !== 'COMPLETED') return current
    const reviewCount = await applicableReviewCount(tx, catalogRevision)
    if (current.reviewCount === reviewCount) return current
    // Guarded correction of derived audit data only. Decisions and queue rows are
    // untouched, so a normal post-deploy sync repairs the initial production run.
    return tx.forceCurveSyncRun.update({ where: { id: current.id }, data: { reviewCount } })
  })
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

function catalogMeasurementKey(entry: MatchCatalog) {
  const parent = entry.repositoryPath?.split('/').at(-2) || ''
  return `${normalize(parent)}/${normalize(entry.displayName)}`
}

export function collapseAutomaticCandidates(candidates: MatchCatalog[]) {
  const groups = new Map<string, MatchCatalog[]>()
  for (const candidate of candidates) groups.set(catalogMeasurementKey(candidate), [...(groups.get(catalogMeasurementKey(candidate)) || []), candidate])
  return [...groups.values()].map(group => [...group].sort((a, b) => {
    const aHigh = a.repositoryPath?.endsWith(HIGH_RES_SUFFIX) ? 0 : 1
    const bHigh = b.repositoryPath?.endsWith(HIGH_RES_SUFFIX) ? 0 : 1
    return aHigh - bHigh || (a.repositoryPath || '').localeCompare(b.repositoryPath || '')
  })[0])
}

export function classifyCatalogTree(tree: Array<{ path: string; type: string; sha: string }>): CatalogInput[] {
  return tree.filter(entry => entry.type === 'blob' && !isNonSwitchArtifact(entry.path) && (entry.path.endsWith(RAW_SUFFIX) || entry.path.endsWith(HIGH_RES_SUFFIX) || REVIEW_ONLY_LEGACY_PATHS.has(entry.path))).map(entry => {
    const format: CatalogFormat = entry.path.endsWith(RAW_SUFFIX) ? 'RAW_DATA' : entry.path.endsWith(HIGH_RES_SUFFIX) ? 'HIGH_RESOLUTION_RAW' : 'NONSTANDARD_REVIEW'
    return { path: entry.path, sha: entry.sha, format, measurementKey: measurementKey(entry.path) }
  })
}
