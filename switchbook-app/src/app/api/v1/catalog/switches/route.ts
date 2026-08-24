import { MasterSwitchStatus, Prisma } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePartner } from '@/lib/partner-api/auth'
import { errorResponse, PartnerApiError } from '@/lib/partner-api/errors'
import { lightweight, partnerSwitchInclude, toPartnerSwitch } from '@/lib/partner-api/catalog'
import { cacheableJson } from '@/lib/partner-api/http'

const querySchema = z.object({
  q: z.string().trim().max(120).optional(),
  manufacturer: z.string().trim().max(100).optional(),
  type: z.enum(['LINEAR','TACTILE','CLICKY','SILENT_LINEAR','SILENT_TACTILE','MOUSE']).optional(),
  technology: z.enum(['MECHANICAL','OPTICAL','MAGNETIC','INDUCTIVE','ELECTRO_CAPACITIVE']).optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(['name','updatedAt','createdAt']).default('name'),
  order: z.enum(['asc','desc']).default('asc'),
})

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  try {
    await requirePartner(request, ['catalog:read'])
    const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams))
    if (!parsed.success) throw new PartnerApiError(400, 'invalid_request', 'Invalid catalog query', parsed.error.flatten())
    const { q, manufacturer, type, technology, cursor, limit, sort, order } = parsed.data
    const where: Prisma.MasterSwitchWhereInput = {
      status: MasterSwitchStatus.APPROVED,
      lifecycle: { is: { OR: [{ status: 'ACTIVE' }, { status: { equals: undefined } }] } },
      ...(q ? { OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { chineseName: { contains: q, mode: 'insensitive' } },
        { manufacturer: { contains: q, mode: 'insensitive' } },
      ] } : {}),
      ...(manufacturer ? { manufacturer: { equals: manufacturer, mode: 'insensitive' } } : {}),
      ...(type ? { type } : {}), ...(technology ? { technology } : {}),
    }
    // Null lifecycle means legacy active; Prisma relation filters cannot express that inside `is`.
    delete where.lifecycle
    where.AND = [{ OR: [{ lifecycle: null }, { lifecycle: { status: 'ACTIVE' } }] }]
    const records = await prisma.masterSwitch.findMany({
      where, include: partnerSwitchInclude, orderBy: [{ [sort]: order }, { id: 'asc' }],
      take: limit + 1, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    })
    const hasMore = records.length > limit
    const page = records.slice(0, limit)
    const data = await Promise.all(page.map(toPartnerSwitch))
    const updatedAt = page.reduce((latest, item) => item.updatedAt > latest ? item.updatedAt : latest, new Date(0))
    return cacheableJson(request, { data: data.map(lightweight), page: { nextCursor: hasMore ? page.at(-1)?.id : null, hasMore, limit } }, updatedAt)
  } catch (error) { return errorResponse(error, requestId) }
}
