import { PrismaClient } from '@prisma/client'
import { buildReviewQueue, QueueReview, ReviewBucket, reviewWorkflow } from '@/lib/admin-force-curves'

const PAGE_SIZE_DEFAULT = 50
const PAGE_SIZE_MAX = 100

type QueueDiagnostics = (stage: string, durationMs: number) => void
type CachedQueue = { fingerprint: string; queue: ReturnType<typeof buildReviewQueue> }
const queueCache = new WeakMap<object, CachedQueue>()

export function invalidateForceCurveReviewQueue(db: PrismaClient) {
  queueCache.delete(db)
}

export type ForceCurveQueueFilters = {
  page?: number
  pageSize?: number
  query?: string
  bucket?: ReviewBucket | 'ALL'
  status?: 'OPEN' | 'RESOLVED' | 'DEFERRED' | 'ALL'
}

const candidateIds = (payload: unknown) => {
  if (typeof payload !== 'object' || !payload || Array.isArray(payload)) return []
  const value = (payload as { candidateIds?: unknown }).candidateIds
  return Array.isArray(value) && value.every(id => typeof id === 'string') ? value : []
}

async function queueFingerprint(db: PrismaClient) {
  const [reviews, catalog, masters] = await Promise.all([
    db.forceCurveReviewCase.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    db.forceCurveCatalogEntry.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
    db.masterSwitch.aggregate({ _count: { _all: true }, _max: { updatedAt: true } }),
  ])
  return [reviews, catalog, masters].map(value => `${value._count._all}:${value._max.updatedAt?.getTime() || 0}`).join('|')
}

function projectItem(item: ReturnType<typeof buildReviewQueue>['items'][number]) {
  return {
    sourceKey: item.sourceKey,
    primaryReviewId: item.primaryReviewId,
    bucket: item.bucket,
    confidence: item.confidence,
    actionable: item.actionable,
    deferred: item.deferred,
    attached: item.attached,
    status: item.status,
    evidence: item.evidence.map(review => ({
      id: review.id,
      kind: review.kind,
      reason: review.reason,
      // ATTACHED is complete queue work but deliberately remains OPEN in the
      // adjudication model. Project it as resolved so a later source refresh
      // cannot make the client resubmit historical evidence with new rows.
      status: review.status === 'OPEN' && reviewWorkflow(review.payload).status === 'ATTACHED' ? 'RESOLVED' : review.status,
      catalogEntryId: review.catalogEntryId,
      masterSwitch: review.masterSwitch,
      candidates: review.candidates.map(({ exists: _exists, ...candidate }) => candidate),
    })),
  }
}

export async function getForceCurveReviewQueuePage(filters: ForceCurveQueueFilters = {}, db: PrismaClient, diagnose?: QueueDiagnostics) {
  let started = performance.now()
  const fingerprint = await queueFingerprint(db)
  diagnose?.('fingerprint', performance.now() - started)
  let queue = queueCache.get(db)?.fingerprint === fingerprint ? queueCache.get(db)!.queue : null
  diagnose?.(queue ? 'cache-hit' : 'cache-miss', 0)

  if (!queue) {
    started = performance.now()
  const reviews = await db.forceCurveReviewCase.findMany({
    select: {
      id: true, kind: true, reason: true, masterSwitchId: true, catalogEntryId: true,
      status: true, resolution: true, payload: true,
      masterSwitch: { select: { id: true, name: true, manufacturer: true, technology: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
    diagnose?.('review-query', performance.now() - started)
  const allIds = [...new Set(reviews.flatMap(review => [...candidateIds(review.payload), ...(review.catalogEntryId ? [review.catalogEntryId] : [])]))]
    started = performance.now()
  const candidates = await db.forceCurveCatalogEntry.findMany({
    where: { id: { in: allIds }, exists: true },
    select: { id: true, source: true, displayName: true, repositoryPath: true, manufacturer: true, technology: true, contentHash: true, revision: true, exists: true },
  })
    diagnose?.('candidate-query', performance.now() - started)
    started = performance.now()
  const candidateMap = new Map(candidates.map(candidate => [candidate.id, candidate]))
    queue = buildReviewQueue(reviews.map(review => ({
    ...review,
    candidates: [...new Set([...candidateIds(review.payload), ...(review.catalogEntryId ? [review.catalogEntryId] : [])])]
      .flatMap(id => candidateMap.get(id) || []),
  })) as QueueReview[])
    diagnose?.('group-enrich-sort', performance.now() - started)
    queueCache.set(db, { fingerprint, queue })
  }

  started = performance.now()
  const query = (filters.query || '').trim().toLowerCase()
  const bucket = filters.bucket || 'ALL'
  const status = filters.status || 'OPEN'
  const filtered = queue.items.filter(item =>
    (bucket === 'ALL' || item.bucket === bucket) &&
    (status === 'ALL' || (status === 'DEFERRED' ? item.status === 'OPEN' && item.deferred : item.status === status && !item.deferred)) &&
    (!query || `${item.sourceKey} ${item.evidence.flatMap(e => [e.reason, e.kind, e.masterSwitch?.name, e.masterSwitch?.manufacturer, ...e.candidates.map(c => c.repositoryPath)]).join(' ')}`.toLowerCase().includes(query))
  )
  const requestedPageSize = Number.isFinite(filters.pageSize) ? Math.trunc(filters.pageSize!) : PAGE_SIZE_DEFAULT
  const requestedPage = Number.isFinite(filters.page) ? Math.trunc(filters.page!) : 1
  const pageSize = Math.min(PAGE_SIZE_MAX, Math.max(1, requestedPageSize))
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const page = Math.min(pageCount, Math.max(1, requestedPage))
  const result = {
    ...queue,
    items: filtered.slice((page - 1) * pageSize, page * pageSize).map(projectItem),
    filteredSourceCount: filtered.length,
    pagination: { page, pageSize, pageCount, hasPrevious: page > 1, hasNext: page < pageCount },
  }
  diagnose?.('filter-project', performance.now() - started)
  return result
}
