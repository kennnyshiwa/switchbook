import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePartner } from '@/lib/partner-api/auth'
import { errorResponse, PartnerApiError } from '@/lib/partner-api/errors'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  try {
    const principal = await requirePartner(request, ['submissions:read'])
    if (!principal.userId) throw new PartnerApiError(403, 'user_authorization_required', 'An OAuth user token is required')
    const { id } = await params
    const item = await prisma.partnerSubmission.findFirst({ where: { id, applicationId: principal.applicationId, userId: principal.userId } })
    if (!item) throw new PartnerApiError(404, 'not_found', 'Submission not found')
    return NextResponse.json({ data: { id, status: item.status.toLowerCase(), moderatorFeedback: item.moderatorFeedback, canonicalId: item.status === 'APPROVED' ? item.masterSwitchId : null, updatedAt: item.updatedAt } })
  } catch (error) { return errorResponse(error, requestId) }
}
