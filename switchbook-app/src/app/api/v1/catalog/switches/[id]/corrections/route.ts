import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auditPartner, requirePartner, type PartnerPrincipal } from '@/lib/partner-api/auth'
import { errorResponse, PartnerApiError } from '@/lib/partner-api/errors'
import { correctionSchema } from '@/lib/partner-api/schemas'
import { beginIdempotent, failIdempotent, finishIdempotent, type IdempotencyReservation } from '@/lib/partner-api/idempotency'

const ALLOWED_FIELDS = new Set(['name','chineseName','manufacturer','type','technology','initialForce','actuationForce','tactileForce','bottomOutForce','preTravel','bottomOut','tactilePosition','springWeight','springLength','progressiveSpring','doubleStage','compatibility','topHousing','bottomHousing','stem','topHousingColor','bottomHousingColor','stemColor','stemShape','markings','magnetOrientation','magnetPosition','magnetPolarity','initialMagneticFlux','bottomOutMagneticFlux','pcbThickness','notes'])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  let principal: PartnerPrincipal | undefined
  let idem: IdempotencyReservation | undefined
  try {
    principal = await requirePartner(request, ['corrections:write'])
    if (!principal.userId) throw new PartnerApiError(403, 'user_authorization_required', 'An OAuth user token is required')
    const partner = principal
    const { id } = await params
    const parsed = correctionSchema.safeParse(await request.json())
    if (!parsed.success) throw new PartnerApiError(400, 'validation_error', 'Invalid correction', parsed.error.flatten())
    const invalidFields = Object.keys(parsed.data.changes).filter(field => !ALLOWED_FIELDS.has(field))
    if (invalidFields.length) throw new PartnerApiError(400, 'invalid_fields', 'Correction includes unsupported fields', { fields: invalidFields })
    idem = await beginIdempotent(principal.applicationId, request.headers.get('idempotency-key'), parsed.data)
    if (idem.replay) return NextResponse.json(idem.replay.body, { status: idem.replay.status, headers: { 'Idempotent-Replayed': 'true' } })
    const current = await prisma.masterSwitch.findFirst({ where: { id, status: 'APPROVED', OR: [{ lifecycle: null }, { lifecycle: { status: 'ACTIVE' } }] } })
    if (!current) throw new PartnerApiError(404, 'not_found', 'Active switch not found')
    const created = await prisma.$transaction(async tx => {
      const edit = await tx.masterSwitchEdit.create({ data: { masterSwitchId: id, editedById: partner.userId!, previousData: current as unknown as Prisma.InputJsonValue, newData: { ...parsed.data.changes, editReason: parsed.data.reason } as Prisma.InputJsonValue, changedFields: Object.keys(parsed.data.changes), status: 'PENDING' } })
      return tx.partnerCorrection.create({ data: { applicationId: partner.applicationId, userId: partner.userId!, masterSwitchId: id, masterSwitchEditId: edit.id, changes: parsed.data.changes as Prisma.InputJsonValue, reason: parsed.data.reason, status: 'SUBMITTED' } })
    })
    const body = { data: { id: created.id, status: created.status.toLowerCase(), switchId: id, updatedAt: created.updatedAt } }
    await finishIdempotent(principal.applicationId, idem.key, idem.requestHash, 202, body)
    await auditPartner(request, principal, 'correction.create', 202, { type: 'partner_correction', id: created.id })
    return NextResponse.json(body, { status: 202 })
  } catch (error) {
    if (principal && idem) await failIdempotent(principal.applicationId, idem, error, requestId)
    return errorResponse(error, requestId)
  }
}
