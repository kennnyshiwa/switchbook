import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auditPartner, requirePartner } from '@/lib/partner-api/auth'
import { errorResponse, PartnerApiError } from '@/lib/partner-api/errors'
import { correctionSchema } from '@/lib/partner-api/schemas'
import { runIdempotentTransaction, storedPartnerError } from '@/lib/partner-api/idempotency'

const ALLOWED_FIELDS = new Set(['name','chineseName','manufacturer','type','technology','initialForce','actuationForce','tactileForce','bottomOutForce','preTravel','bottomOut','tactilePosition','springWeight','springLength','progressiveSpring','doubleStage','compatibility','topHousing','bottomHousing','stem','topHousingColor','bottomHousingColor','stemColor','stemShape','markings','magnetOrientation','magnetPosition','magnetPolarity','initialMagneticFlux','bottomOutMagneticFlux','pcbThickness','notes'])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  try {
    const principal = await requirePartner(request, ['corrections:write'])
    if (!principal.userId) throw new PartnerApiError(403, 'user_authorization_required', 'An OAuth user token is required')
    const partner = principal
    const { id } = await params
    const parsed = correctionSchema.safeParse(await request.json())
    if (!parsed.success) throw new PartnerApiError(400, 'validation_error', 'Invalid correction', parsed.error.flatten())
    const invalidFields = Object.keys(parsed.data.changes).filter(field => !ALLOWED_FIELDS.has(field))
    if (invalidFields.length) throw new PartnerApiError(400, 'invalid_fields', 'Correction includes unsupported fields', { fields: invalidFields })
    const result = await runIdempotentTransaction(principal.applicationId, request.headers.get('idempotency-key'), parsed.data, async tx => {
      const current = await tx.masterSwitch.findFirst({ where: { id, status: 'APPROVED', OR: [{ lifecycle: null }, { lifecycle: { status: 'ACTIVE' } }] } })
      if (!current) return storedPartnerError(new PartnerApiError(404, 'not_found', 'Active switch not found'), requestId)
      const edit = await tx.masterSwitchEdit.create({ data: { masterSwitchId: id, editedById: partner.userId!, previousData: current as unknown as Prisma.InputJsonValue, newData: { ...parsed.data.changes, editReason: parsed.data.reason } as Prisma.InputJsonValue, changedFields: Object.keys(parsed.data.changes), status: 'PENDING' } })
      const created = await tx.partnerCorrection.create({ data: { applicationId: partner.applicationId, userId: partner.userId!, masterSwitchId: id, masterSwitchEditId: edit.id, changes: parsed.data.changes as Prisma.InputJsonValue, reason: parsed.data.reason, status: 'SUBMITTED' } })
      return { status: 202, body: { data: { id: created.id, status: created.status.toLowerCase(), switchId: id, updatedAt: created.updatedAt.toISOString() } } }
    })
    await auditPartner(request, principal, 'correction.create', result.status, { type: 'partner_correction' })
    return NextResponse.json(result.body, { status: result.status, headers: result.replayed ? { 'Idempotent-Replayed': 'true' } : undefined })
  } catch (error) { return errorResponse(error, requestId) }
}
