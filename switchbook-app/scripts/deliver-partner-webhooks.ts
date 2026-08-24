import { createHmac } from 'node:crypto'
import { prisma } from '../src/lib/prisma'
import { openSecret } from '../src/lib/partner-api/crypto'
import { assertSafeWebhookUrl } from '../src/lib/partner-api/outbound'

async function main() {
  const events = await prisma.partnerWebhookEvent.findMany({ where: { status: 'PENDING', nextAttemptAt: { lte: new Date() } }, include: { application: true }, take: 50, orderBy: { createdAt: 'asc' } })
  for (const event of events) {
    if (!event.application.webhookUrl || !event.application.webhookSecretEnvelope) continue
    const body = JSON.stringify({ id: event.id, type: event.type, createdAt: event.createdAt, data: event.payload })
    const timestamp = Math.floor(Date.now() / 1000).toString()
    try {
      const target = await assertSafeWebhookUrl(event.application.webhookUrl)
      const webhookSecret = openSecret(event.application.webhookSecretEnvelope)
      const signature = createHmac('sha256', webhookSecret).update(`${timestamp}.${body}`).digest('hex')
      const response = await fetch(target, { method: 'POST', headers: { 'Content-Type':'application/json', 'User-Agent':'SwitchBook-Webhooks/1.0', 'X-SwitchBook-Timestamp':timestamp, 'X-SwitchBook-Signature':`v1=${signature}` }, body, signal: AbortSignal.timeout(10_000), redirect: 'error' })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      await prisma.partnerWebhookEvent.update({ where: { id: event.id }, data: { status: 'DELIVERED', attempts: { increment: 1 }, deliveredAt: new Date(), lastError: null } })
    } catch (error) {
      const attempts = event.attempts + 1
      await prisma.partnerWebhookEvent.update({ where: { id: event.id }, data: { status: attempts >= 8 ? 'FAILED' : 'PENDING', attempts, nextAttemptAt: new Date(Date.now() + Math.min(3600, 2 ** attempts * 15) * 1000), lastError: error instanceof Error ? error.message.slice(0, 500) : 'Delivery failed' } })
    }
  }
}
main().finally(() => prisma.$disconnect())
