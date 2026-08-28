import { PrismaClient } from '@prisma/client'
import { buildReviewQueue, QueueReview, ReviewBucket } from '@/lib/admin-force-curves'

const PAGE_SIZE_DEFAULT = 50
const PAGE_SIZE_MAX = 100

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

export async function getForceCurveReviewQueuePage(filters: ForceCurveQueueFilters = {}, db: PrismaClient) {
  const reviews = await db.forceCurveReviewCase.findMany({
    select: {
      id: true, kind: true, reason: true, masterSwitchId: true, catalogEntryId: true,
      status: true, resolution: true, payload: true,
      masterSwitch: { select: { id: true, name: true, manufacturer: true, technology: true } },
    },
    orderBy: { createdAt: 'asc' },
  })
  const allIds = [...new Set(reviews.flatMap(review => [...candidateIds(review.payload), ...(review.catalogEntryId ? [review.catalogEntryId] : [])]))]
  const candidates = await db.forceCurveCatalogEntry.findMany({
    where: { id: { in: allIds }, exists: true },
    select: { id: true, displayName: true, repositoryPath: true, manufacturer: true, technology: true, contentHash: true, revision: true, exists: true },
  })
  const candidateMap = new Map(candidates.map(candidate => [candidate.id, candidate]))
  const queue = buildReviewQueue(reviews.map(review => ({
    ...review,
    candidates: [...new Set([...candidateIds(review.payload), ...(review.catalogEntryId ? [review.catalogEntryId] : [])])]
      .flatMap(id => candidateMap.get(id) || []),
  })) as QueueReview[])

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
  return {
    ...queue,
    items: filtered.slice((page - 1) * pageSize, page * pageSize),
    filteredSourceCount: filtered.length,
    pagination: { page, pageSize, pageCount, hasPrevious: page > 1, hasNext: page < pageCount },
  }
}
