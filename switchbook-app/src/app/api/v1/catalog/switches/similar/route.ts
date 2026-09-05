import { MasterSwitchStatus, Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auditPartner, requirePartner } from '@/lib/partner-api/auth'
import { absoluteCatalogUrl } from '@/lib/partner-api/catalog'
import { errorResponse, PartnerApiError } from '@/lib/partner-api/errors'
import { cacheableJson } from '@/lib/partner-api/http'
import { rankCatalogCandidates, SIMILAR_SEARCH_CANDIDATE_LIMIT, validateSimilarityQuery } from '@/lib/partner-api/similarity'

const querySchema = z.object({
  q: z.string(),
  manufacturer: z.string().trim().min(1).max(100).optional(),
  type: z.enum(['LINEAR','TACTILE','CLICKY','SILENT_LINEAR','SILENT_TACTILE','MOUSE']).optional(),
  technology: z.enum(['MECHANICAL','OPTICAL','MAGNETIC','INDUCTIVE','ELECTRO_CAPACITIVE']).optional(),
  limit: z.coerce.number().int().min(1).max(25).default(10),
}).strict()

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  try {
    const principal = await requirePartner(request, ['catalog:read'])
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) throw new PartnerApiError(400, 'invalid_request', 'Invalid similarity query', parsed.error.flatten())
    const validated = validateSimilarityQuery(parsed.data.q)
    if (!validated.ok) throw new PartnerApiError(400, 'invalid_request', validated.reason)
    const { manufacturer, type, technology, limit } = parsed.data
    const where: Prisma.MasterSwitchWhereInput = {
      status: MasterSwitchStatus.APPROVED,
      AND: [{ OR: [{ lifecycle: null }, { lifecycle: { status: 'ACTIVE' } }] }],
      ...(manufacturer ? { manufacturer: { equals: manufacturer, mode: 'insensitive' } } : {}),
      ...(type ? { type } : {}), ...(technology ? { technology } : {}),
    }
    const records = await prisma.masterSwitch.findMany({
      where,
      select: {
        id: true, name: true, chineseName: true, manufacturer: true, type: true, technology: true,
        imageUrl: true, updatedAt: true,
        images: { select: { url: true }, orderBy: { order: 'asc' }, take: 1 },
      },
      orderBy: { id: 'asc' }, take: SIMILAR_SEARCH_CANDIDATE_LIMIT + 1,
    })
    if (records.length > SIMILAR_SEARCH_CANDIDATE_LIMIT) {
      throw new PartnerApiError(503, 'search_capacity_exceeded', 'Similarity search candidate capacity exceeded; narrow the query with filters')
    }
    const ranked = rankCatalogCandidates(validated.normalized, records, limit)
    const recordsById = new Map(records.map(record => [record.id, record]))
    const data = ranked.map(({ candidate, match }) => {
      const record = recordsById.get(candidate.id)!
      const thumbnailPath = record.images[0]?.url || record.imageUrl
      return {
        id: record.id, status: 'ACTIVE' as const, mergedIntoId: null,
        name: record.name, manufacturer: record.manufacturer, type: record.type,
        technology: record.technology, thumbnail: thumbnailPath ? absoluteCatalogUrl(thumbnailPath) : null,
        recordUrl: absoluteCatalogUrl(`/switches/${record.id}`),
        updatedAt: record.updatedAt.toISOString(), match,
      }
    })
    const updatedAt = ranked.reduce((latest, item) => {
      const record = recordsById.get(item.candidate.id)!
      return record.updatedAt > latest ? record.updatedAt : latest
    }, new Date(0))
    await auditPartner(request, principal, 'catalog.similar', 200, { type: 'master_switch' })
    return cacheableJson(request, {
      data,
      meta: {
        limit, candidateCount: records.length,
        advisory: true,
        rankScoreMeaning: 'Heuristic ordering only; not confidence or probability. Confirm identity using the stable SwitchBook ID and full record.',
      },
    }, updatedAt)
  } catch (error) { return errorResponse(error, requestId) }
}
