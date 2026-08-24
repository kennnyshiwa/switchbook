import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { runIdempotentTransaction, storedPartnerError } from '../src/lib/partner-api/idempotency'
import { PartnerApiError } from '../src/lib/partner-api/errors'

async function main() {
const application = await prisma.partnerApplication.create({ data: {
  name: 'E2E', clientId: 'idempotency-e2e', secretHash: 'not-a-secret', scopes: ['catalog:read'], redirectUris: [],
} })

await assert.rejects(() => runIdempotentTransaction(application.id, 'fault-after-write', { value: 1 }, async tx => {
  await tx.partnerAuditEvent.create({ data: { applicationId: application.id, requestId: 'fault', action: 'business.write', statusCode: 202 } })
  throw new Error('fault injected before response finalization')
}))
assert.equal(await prisma.partnerAuditEvent.count({ where: { requestId: 'fault' } }), 0)
assert.equal(await prisma.partnerIdempotencyKey.count({ where: { applicationId: application.id, key: 'fault-after-write' } }), 0)

const concurrent = await Promise.all(Array.from({ length: 6 }, () => runIdempotentTransaction(application.id, 'concurrent', { value: 2 }, async tx => {
  await tx.partnerAuditEvent.create({ data: { applicationId: application.id, requestId: 'concurrent', action: 'business.write', statusCode: 202 } })
  return { status: 202, body: { data: { id: 'only-once' } } }
})))
assert.equal(await prisma.partnerAuditEvent.count({ where: { requestId: 'concurrent' } }), 1)
assert.equal(concurrent.filter(result => !result.replayed).length, 1)
assert.equal(concurrent.filter(result => result.replayed).length, 5)

const expected = storedPartnerError(new PartnerApiError(409, 'possible_duplicate', 'Possible duplicate records found', { records: [{ id: 'canonical-1', name: 'Oil King' }] }), 'request-e2e')
const first = await runIdempotentTransaction(application.id, 'deterministic-error', { value: 3 }, async () => expected)
const replay = await runIdempotentTransaction(application.id, 'deterministic-error', { value: 3 }, async () => { throw new Error('must not execute') })
assert.deepEqual(replay.body, first.body)
assert.equal(replay.replayed, true)
console.log('Partner idempotency E2E PASS: rollback after injected fault, exactly-once concurrency, exact deterministic replay.')

}

main().finally(() => prisma.$disconnect())
