import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditPartner, requirePartner } from '@/lib/partner-api/auth'
import { errorResponse, PartnerApiError } from '@/lib/partner-api/errors'
import { proposedSwitchSchema } from '@/lib/partner-api/schemas'
import { runIdempotentTransaction, storedPartnerError } from '@/lib/partner-api/idempotency'
import { rehostRemoteImage } from '@/lib/remote-image'

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
      return { status: 202, body: { data: { id: submission.id, status: submission.status.toLowerCase(), canonicalId: null, candidateId: masterSwitch.id, imageErrors: [] } } }
    })
    const responseData = (result.body as { data?: { candidateId?: string } }).data
    if (result.status === 202 && responseData?.candidateId) {
      await associateSubmissionPhotos(responseData.candidateId, photos)
    }
    await auditPartner(request, principal, 'submission.create', result.status, { type: 'partner_submission' })
    return NextResponse.json(result.body, { status: result.status, headers: result.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
  } catch (error) { return errorResponse(error, requestId) }
}

async function associateSubmissionPhotos(masterSwitchId: string, photos: Array<{ url: string; alt: string; sourceUrl?: string; license?: string; attribution?: string }>) {
  for (const [index, photo] of photos.entries()) {
    const sourceUrl = photo.sourceUrl || photo.url
    try {
      const alreadyLinked = await prisma.switchImage.findFirst({ where: { masterSwitchId, sourceUrl } })
      if (alreadyLinked) continue
      const uploaded = await rehostRemoteImage(photo.url, `master-switches/${masterSwitchId}`)
      await prisma.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${masterSwitchId}:${sourceUrl}`}))`
        const existing = await tx.switchImage.findFirst({ where: { masterSwitchId, sourceUrl } })
        if (!existing) await tx.switchImage.create({ data: { masterSwitchId, url: uploaded.url, order: index, width: uploaded.width, height: uploaded.height, size: uploaded.size, checksumSha256: uploaded.checksumSha256, altText: photo.alt, sourceUrl, license: photo.license, attribution: photo.attribution } })
      })
    } catch (error) {
      console.warn('[partner-submission-image]', masterSwitchId, error instanceof Error ? error.message : 'Image rejected')
    }
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
