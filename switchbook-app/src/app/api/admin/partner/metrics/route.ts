import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const [requests, byStatus, byAction, pendingWebhooks, failedWebhooks] = await Promise.all([
    prisma.partnerAuditEvent.count({ where: { createdAt: { gte: since } } }),
    prisma.partnerAuditEvent.groupBy({ by: ['statusCode'], where: { createdAt: { gte: since } }, _count: true }),
    prisma.partnerAuditEvent.groupBy({ by: ['action'], where: { createdAt: { gte: since } }, _count: true, orderBy: { _count: { action: 'desc' } }, take: 20 }),
    prisma.partnerWebhookEvent.count({ where: { status: 'PENDING' } }),
    prisma.partnerWebhookEvent.count({ where: { status: 'FAILED' } }),
  ])
  return NextResponse.json({ window: { since, hours: 24 }, requests, byStatus, byAction, webhooks: { pending: pendingWebhooks, failed: failedWebhooks } })
}
