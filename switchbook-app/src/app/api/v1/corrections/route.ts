import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auditPartner, requirePartner } from '@/lib/partner-api/auth'
import { errorResponse, PartnerApiError } from '@/lib/partner-api/errors'

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  try {
    const principal = await requirePartner(request, ['submissions:read'])
    if (!principal.userId) throw new PartnerApiError(403, 'user_authorization_required', 'An OAuth user token is required')
    const items = await prisma.partnerCorrection.findMany({ where: { applicationId: principal.applicationId, userId: principal.userId }, orderBy: { updatedAt: 'desc' }, take: 100 })
    await auditPartner(request, principal, 'correction.list', 200, { type: 'partner_correction' })
    return NextResponse.json({ data: items.map(item => ({ id: item.id, switchId: item.masterSwitchId, status: item.status.toLowerCase(), moderatorFeedback: item.moderatorFeedback, updatedAt: item.updatedAt })) })
  } catch (error) { return errorResponse(error, requestId) }
}
