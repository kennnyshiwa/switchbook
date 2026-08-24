import { createHmac } from 'node:crypto'
import { prisma } from '../src/lib/prisma'

async function main() {
  const events = await prisma.partnerWebhookEvent.findMany({ where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } }, include: { application: true }, take: 50, orderBy: { createdAt: 'asc' } })
  for (const event of events) {
    if (!event.application.webhookUrl || !event.application.webhookSecretHash) continue
    const body = JSON.stringify({ id: event.id, type: event.type, createdAt: event.createdAt, data: event.payload })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const signature = createHmac('sha256', Buffer.from(event.application.webhookSecretHash, 'hex')).update(`${timestamp}.${body}`).digest('hex')
    try {
      const response = await fetch(event.application.webhookUrl, { method: 'POST', headers: { 'Content-Type':'application/json', 'User-Agent':'SwitchBook-Webhooks/1.0', 'X-SwitchBook-Timestamp':timestamp, 'X-SwitchBook-Signature':`v1=${signature}` }, body, signal: AbortSignal.timeout(10_000), redirect: 'error' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await prisma.partnerWebhookEvent.update({ where: { id: event.id }, data: { status: 'DELIVERED', attempts: { increment: 1 }, deliveredAt: new Date(), lastError: null } })
    } catch (error) {
      const attempts = event.attempts + 1
      await prisma.partnerWebhookEvent.update({ where: { id: event.id }, data: { status: attempts >= 8 ? 'FAILED' : 'PENDING', attempts, nextAttemptAt: new Date(Date.now() + Math.min(3600, 2 ** attempts * 15) * 1000), lastError: error instanceof Error ? error.message.slice(0, 500) : 'Delivery failed' } })
    }
  }
}
main().finally(() => prisma.$disconnect())
