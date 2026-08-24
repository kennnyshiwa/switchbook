import { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

type Db = Prisma.TransactionClient | PrismaClient

async function enqueue(db: Db, applicationId: string, type: string, payload: Prisma.InputJsonValue) {
  const app = await db.partnerApplication.findUnique({ where: { id: applicationId }, select: { webhookUrl: true, active: true } })
  if (app?.active && app.webhookUrl) await db.partnerWebhookEvent.create({ data: { applicationId, type, payload } })
}

export async function resolvePartnerSubmission(masterSwitchId: string, status: 'APPROVED' | 'REJECTED', feedback?: string, db: Db = prisma) {
  const records = await db.partnerSubmission.findMany({ where: { masterSwitchId, status: { in: ['DRAFT','SUBMITTED','NEEDS_CHANGES'] } } })
  for (const record of records) {
    const updated = await db.partnerSubmission.update({ where: { id: record.id }, data: { status, moderatorFeedback: feedback || null } })
    await enqueue(db, record.applicationId, `submission.${status.toLowerCase()}`, { submissionId: updated.id, status: status.toLowerCase(), canonicalId: status === 'APPROVED' ? masterSwitchId : null, moderatorFeedback: feedback || null, updatedAt: updated.updatedAt.toISOString() })
  }
}

export async function resolvePartnerCorrection(masterSwitchEditId: string, status: 'APPROVED' | 'REJECTED', feedback?: string, db: Db = prisma) {
  const record = await db.partnerCorrection.findUnique({ where: { masterSwitchEditId } })
  if (!record) return
  const updated = await db.partnerCorrection.update({ where: { id: record.id }, data: { status, moderatorFeedback: feedback || null } })
  await enqueue(db, record.applicationId, `correction.${status.toLowerCase()}`, { correctionId: updated.id, switchId: updated.masterSwitchId, status: status.toLowerCase(), moderatorFeedback: feedback || null, updatedAt: updated.updatedAt.toISOString() })
}
