import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditPartner, requirePartner, type PartnerPrincipal } from '@/lib/partner-api/auth'
import { errorResponse, PartnerApiError } from '@/lib/partner-api/errors'
import { proposedSwitchSchema } from '@/lib/partner-api/schemas'
import { beginIdempotent, failIdempotent, finishIdempotent, type IdempotencyReservation } from '@/lib/partner-api/idempotency'
import { rehostRemoteImage } from '@/lib/remote-image'

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  let principal: PartnerPrincipal | undefined
  let idempotency: IdempotencyReservation | undefined
  try {
    principal = await requirePartner(request, ['submissions:write'])
    if (!principal.userId) throw new PartnerApiError(403, 'user_authorization_required', 'An OAuth user token is required')
    const partner = principal
    const json = await request.json()
    const parsed = proposedSwitchSchema.safeParse(json)
    if (!parsed.success) throw new PartnerApiError(400, 'validation_error', 'Invalid switch proposal', parsed.error.flatten())
    idempotency = await beginIdempotent(principal.applicationId, request.headers.get('idempotency-key'), parsed.data)
    if (idempotency.replay) return NextResponse.json(idempotency.replay.body, { status: idempotency.replay.status, headers: { 'Idempotent-Replayed': 'true' } })

    const possible = await prisma.masterSwitch.findMany({
      where: { status: 'APPROVED', manufacturer: { equals: parsed.data.manufacturer, mode: 'insensitive' }, name: { contains: parsed.data.name, mode: 'insensitive' } },
      select: { id: true, name: true, manufacturer: true }, take: 5,
    })
    if (possible.length && !parsed.data.confirmNotDuplicate) throw new PartnerApiError(409, 'possible_duplicate', 'Possible duplicate records found', { records: possible })
    const { photos, submissionNotes: _submissionNotes, confirmNotDuplicate: _confirm, ...fields } = parsed.data
    const created = await prisma.$transaction(async tx => {
      const masterSwitch = await tx.masterSwitch.create({ data: {
        ...fields, submittedById: partner.userId!, status: 'PENDING', originalSubmissionData: parsed.data as unknown as Prisma.InputJsonValue,
      } })
      const submission = await tx.partnerSubmission.create({ data: {
        applicationId: partner.applicationId, userId: partner.userId!, masterSwitchId: masterSwitch.id,
        payload: parsed.data as unknown as Prisma.InputJsonValue, status: 'SUBMITTED',
      } })
      return { masterSwitch, submission }
    })
    const imageErrors: Array<{ url: string; error: string }> = []
    for (const [index, photo] of photos.entries()) {
      try {
        const uploaded = await rehostRemoteImage(photo.url, `master-switches/${created.masterSwitch.id}`)
        await prisma.switchImage.create({ data: { masterSwitchId: created.masterSwitch.id, url: uploaded.url, order: index, width: uploaded.width, height: uploaded.height, size: uploaded.size, checksumSha256: uploaded.checksumSha256, altText: photo.alt, sourceUrl: photo.sourceUrl || photo.url, license: photo.license, attribution: photo.attribution } })
      } catch (error) { imageErrors.push({ url: photo.url, error: error instanceof Error ? error.message : 'Image rejected' }) }
    }
    const body = { data: { id: created.submission.id, status: created.submission.status.toLowerCase(), canonicalId: null, candidateId: created.masterSwitch.id, imageErrors } }
    await finishIdempotent(principal.applicationId, idempotency.key, idempotency.requestHash, 202, body)
    await auditPartner(request, principal, 'submission.create', 202, { type: 'partner_submission', id: created.submission.id })
    return NextResponse.json(body, { status: 202 })
  } catch (error) {
    if (principal && idempotency) await failIdempotent(principal.applicationId, idempotency, error, requestId)
    return errorResponse(error, requestId)
  }
}

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  try {
    const principal = await requirePartner(request, ['submissions:read'])
    if (!principal.userId) throw new PartnerApiError(403, 'user_authorization_required', 'An OAuth user token is required')
    const data = await prisma.partnerSubmission.findMany({ where: { applicationId: principal.applicationId, userId: principal.userId }, orderBy: { updatedAt: 'desc' }, take: 100 })
    await auditPartner(request, principal, 'submission.list', 200, { type: 'partner_submission' })
    return NextResponse.json({ data: data.map(item => ({ id: item.id, status: item.status.toLowerCase(), moderatorFeedback: item.moderatorFeedback, canonicalId: item.status === 'APPROVED' ? item.masterSwitchId : null, updatedAt: item.updatedAt })) })
  } catch (error) { return errorResponse(error, requestId) }
}
