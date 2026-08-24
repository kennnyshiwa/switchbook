import { NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { PartnerApiError, errorResponse } from '@/lib/partner-api/errors'
import { assertNoMergeCycle } from '@/lib/partner-api/lifecycle'

const schema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('MERGED'), mergedIntoId: z.string().min(1), reason: z.string().min(5).max(1000) }),
  z.object({ status: z.literal('REMOVED'), reason: z.string().min(5).max(1000) }),
])

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  try {
    const session = await auth()
    if (!session?.user?.id || session.user.role !== 'ADMIN') throw new PartnerApiError(403, 'forbidden', 'Administrator access required')
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) throw new PartnerApiError(400, 'validation_error', 'Invalid lifecycle transition', parsed.error.flatten())
    const { id } = await params
    let updated
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        updated = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('switchbook_partner_lifecycle'))`
      const source = await tx.masterSwitch.findUnique({ where: { id }, include: { lifecycle: true } })
      if (!source || !source.approvedAt || source.status !== 'APPROVED' || source.lifecycle && source.lifecycle.status !== 'ACTIVE') {
        throw new PartnerApiError(409, 'invalid_lifecycle_source', 'Only an active, formerly approved record can transition')
      }
      if (parsed.data.status === 'MERGED') {
        const target = await tx.masterSwitch.findUnique({ where: { id: parsed.data.mergedIntoId }, include: { lifecycle: true } })
        if (!target || target.status !== 'APPROVED' || target.lifecycle && target.lifecycle.status !== 'ACTIVE') throw new PartnerApiError(409, 'invalid_merge_target', 'Merge target must be an active approved record')
        await assertNoMergeCycle(id, target.id, async current => (await tx.masterSwitchLifecycle.findUnique({ where: { masterSwitchId: current }, select: { mergedIntoId: true } }))?.mergedIntoId || null)
      }
      const lifecycle = await tx.masterSwitchLifecycle.upsert({
        where: { masterSwitchId: id },
        create: { masterSwitchId: id, catalogApprovedAt: source.approvedAt, status: parsed.data.status, mergedIntoId: parsed.data.status === 'MERGED' ? parsed.data.mergedIntoId : null, removedAt: parsed.data.status === 'REMOVED' ? new Date() : null, removalReason: parsed.data.reason },
        update: { status: parsed.data.status, mergedIntoId: parsed.data.status === 'MERGED' ? parsed.data.mergedIntoId : null, removedAt: parsed.data.status === 'REMOVED' ? new Date() : null, removalReason: parsed.data.reason },
      })
      const apps = await tx.partnerApplication.findMany({ where: { active: true, webhookUrl: { not: null } }, select: { id: true } })
      await tx.partnerWebhookEvent.createMany({ data: apps.map(app => ({ applicationId: app.id, type: `catalog.${parsed.data.status.toLowerCase()}`, payload: { id, status: parsed.data.status, mergedIntoId: parsed.data.status === 'MERGED' ? parsed.data.mergedIntoId : null, updatedAt: lifecycle.updatedAt.toISOString() } })) })
      await tx.partnerAuditEvent.create({ data: { actorUserId: session.user.id, requestId, action: 'catalog.lifecycle.transition', resourceType: 'master_switch', resourceId: id, statusCode: 200, metadata: parsed.data } })
          return lifecycle
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
        break
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue
        throw error
      }
    }
    if (!updated) throw new PartnerApiError(503, 'lifecycle_busy', 'Lifecycle update conflicted; retry the request')
    return NextResponse.json({ data: updated })
  } catch (error) { return errorResponse(error, requestId) }
}
