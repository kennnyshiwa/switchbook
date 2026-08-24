import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditPartner, requirePartner } from '@/lib/partner-api/auth'
import { errorResponse, PartnerApiError } from '@/lib/partner-api/errors'
import { proposedSwitchSchema } from '@/lib/partner-api/schemas'
import { runIdempotentTransaction, storedPartnerError } from '@/lib/partner-api/idempotency'
import { associateSubmissionPhotos, photoOutcome } from '@/lib/partner-api/submission-photos'

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  try {
    const principal = await requirePartner(request, ['submissions:write'])
    if (!principal.userId) throw new PartnerApiError(403, 'user_authorization_required', 'An OAuth user token is required')
    const partner = principal
    const json = await request.json()
    const parsed = proposedSwitchSchema.safeParse(json)
    if (!parsed.success) throw new PartnerApiError(400, 'validation_error', 'Invalid switch proposal', parsed.error.flatten())
    const { photos, submissionNotes: _submissionNotes, confirmNotDuplicate: _confirm, ...fields } = parsed.data
    const result = await runIdempotentTransaction(principal.applicationId, request.headers.get('idempotency-key'), parsed.data, async tx => {
      const possible = await tx.masterSwitch.findMany({
        where: { status: 'APPROVED', manufacturer: { equals: parsed.data.manufacturer, mode: 'insensitive' }, name: { contains: parsed.data.name, mode: 'insensitive' } },
        select: { id: true, name: true, manufacturer: true }, take: 5,
      })
      if (possible.length && !parsed.data.confirmNotDuplicate) {
        return storedPartnerError(new PartnerApiError(409, 'possible_duplicate', 'Possible duplicate records found', { records: possible }), requestId)
      }
      const masterSwitch = await tx.masterSwitch.create({ data: {
        ...fields, submittedById: partner.userId!, status: 'PENDING', originalSubmissionData: parsed.data as unknown as Prisma.InputJsonValue,
      } })
      const submission = await tx.partnerSubmission.create({ data: {
        applicationId: partner.applicationId, userId: partner.userId!, masterSwitchId: masterSwitch.id,
        payload: parsed.data as unknown as Prisma.InputJsonValue, status: 'SUBMITTED',
      } })
      await tx.partnerSubmissionPhoto.createMany({ data: photos.map((photo, order) => ({ submissionId: submission.id, sourceUrl: photo.sourceUrl || photo.url, order })), skipDuplicates: true })
      return { status: 202, body: { data: {
        id: submission.id, status: submission.status.toLowerCase(), canonicalId: null, candidateId: masterSwitch.id,
        photosStatus: photos.length ? 'processing' : 'complete',
        photos: photos.map(photo => ({ sourceUrl: photo.sourceUrl || photo.url, status: 'pending', error: null })),
      } } }
    })
    const responseData = (result.body as { data?: { candidateId?: string } }).data
    if (result.status === 202 && responseData?.candidateId) {
      const submissionId = (result.body as { data?: { id?: string } }).data?.id
      if (submissionId) await associateSubmissionPhotos(submissionId, responseData.candidateId, photos)
    }
    await auditPartner(request, principal, 'submission.create', result.status, { type: 'partner_submission' })
    return NextResponse.json(result.body, { status: result.status, headers: result.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
  } catch (error) { return errorResponse(error, requestId) }
}

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  try {
    const principal = await requirePartner(request, ['submissions:read'])
    if (!principal.userId) throw new PartnerApiError(403, 'user_authorization_required', 'An OAuth user token is required')
    const data = await prisma.partnerSubmission.findMany({ where: { applicationId: principal.applicationId, userId: principal.userId }, include: { photos: { orderBy: { order: 'asc' } } }, orderBy: { updatedAt: 'desc' }, take: 100 })
    await auditPartner(request, principal, 'submission.list', 200, { type: 'partner_submission' })
    return NextResponse.json({ data: data.map(item => ({ id: item.id, status: item.status.toLowerCase(), moderatorFeedback: item.moderatorFeedback, canonicalId: item.status === 'APPROVED' ? item.masterSwitchId : null, updatedAt: item.updatedAt, ...photoOutcome(item.photos) })) })
  } catch (error) { return errorResponse(error, requestId) }
}
