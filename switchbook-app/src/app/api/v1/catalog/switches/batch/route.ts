import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { auditPartner, requirePartner } from '@/lib/partner-api/auth'
import { errorResponse, PartnerApiError } from '@/lib/partner-api/errors'
import { catalogDisposition, partnerSwitchInclude, toPartnerSwitch } from '@/lib/partner-api/catalog'
import { cacheableJson } from '@/lib/partner-api/http'

const bodySchema = z.object({ ids: z.array(z.string().min(1)).min(1).max(100).transform(ids => [...new Set(ids)]) })

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  try {
    const principal = await requirePartner(request, ['catalog:read'])
    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) throw new PartnerApiError(400, 'invalid_request', 'ids must contain 1–100 unique IDs', parsed.error.flatten())
    const records = await prisma.masterSwitch.findMany({ where: { id: { in: parsed.data.ids } }, include: partnerSwitchInclude })
    const byId = new Map(records.map(record => [record.id, record]))
    const results = await Promise.all(parsed.data.ids.map(async id => {
      const record = byId.get(id)
      if (!record || catalogDisposition(record.status, record.lifecycle) === 'NOT_FOUND') return { id, status: 'NOT_FOUND' }
      const value = await toPartnerSwitch(record)
      return value.status === 'ACTIVE' ? { id, status: 'ACTIVE', data: value } : { id, status: value.status, mergedIntoId: value.mergedIntoId, updatedAt: value.updatedAt }
    }))
    const updatedAt = records.reduce((latest, item) => item.updatedAt > latest ? item.updatedAt : latest, new Date(0))
    await auditPartner(request, principal, 'catalog.batch', 200, { type: 'master_switch' })
    return cacheableJson(request, { data: results }, updatedAt)
  } catch (error) { return errorResponse(error, requestId) }
}
