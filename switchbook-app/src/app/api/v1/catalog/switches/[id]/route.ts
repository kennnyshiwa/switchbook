import { prisma } from '@/lib/prisma'
import { auditPartner, requirePartner } from '@/lib/partner-api/auth'
import { errorResponse, PartnerApiError } from '@/lib/partner-api/errors'
import { catalogDisposition, partnerSwitchInclude, toPartnerSwitch } from '@/lib/partner-api/catalog'
import { cacheableJson } from '@/lib/partner-api/http'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  try {
    const principal = await requirePartner(request, ['catalog:read'])
    const { id } = await params
    const record = await prisma.masterSwitch.findUnique({ where: { id }, include: partnerSwitchInclude })
    if (!record || catalogDisposition(record.status, record.lifecycle) === 'NOT_FOUND') {
      throw new PartnerApiError(404, 'not_found', 'Switch not found')
    }
    const data = await toPartnerSwitch(record)
    await auditPartner(request, principal, 'catalog.read', 200, { type: 'master_switch', id })
    if (data.status === 'REMOVED') return cacheableJson(request, { id, status: data.status, mergedIntoId: null, updatedAt: data.updatedAt }, record.updatedAt)
    if (data.status === 'MERGED') return cacheableJson(request, { id, status: data.status, mergedIntoId: data.mergedIntoId, updatedAt: data.updatedAt }, record.updatedAt)
    return cacheableJson(request, { data }, record.updatedAt)
  } catch (error) { return errorResponse(error, requestId) }
}
