import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { runIdempotentTransaction, storedPartnerError } from '../src/lib/partner-api/idempotency'
import { PartnerApiError } from '../src/lib/partner-api/errors'
import { associateSubmissionPhotos } from '../src/lib/partner-api/submission-photos'

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

const user = await prisma.user.create({ data: { email: 'photo-e2e@example.com', username: 'photo-e2e' } })
const master = await prisma.masterSwitch.create({ data: { name: 'Photo E2E', manufacturer: 'E2E', submittedById: user.id } })
const submission = await prisma.partnerSubmission.create({ data: { applicationId: application.id, userId: user.id, masterSwitchId: master.id, payload: {}, status: 'SUBMITTED' } })
const sourceUrl = 'https://images.example.com/photo.png'
await prisma.partnerSubmissionPhoto.create({ data: { submissionId: submission.id, sourceUrl, order: 0 } })
let downloads = 0
let cleanupCalls = 0
const generated = new Set<string>()
const fakeDownload = async () => {
  downloads++
  const pathname = `e2e/${downloads}.png`
  generated.add(pathname)
  await new Promise(resolve => setTimeout(resolve, 20))
  return { url: `/uploads/${pathname}`, pathname, width: 10, height: 10, size: 100, checksumSha256: 'abc' }
}
const fakeRemove = async (pathname: string) => { cleanupCalls++; generated.delete(pathname) }
const photo = { url: sourceUrl, sourceUrl, alt: 'E2E photo' }
await Promise.all(Array.from({ length: 6 }, () => associateSubmissionPhotos(submission.id, master.id, [photo], fakeDownload, fakeRemove)))
const linked = await prisma.switchImage.findMany({ where: { masterSwitchId: master.id, sourceUrl } })
const photoJob = await prisma.partnerSubmissionPhoto.findUniqueOrThrow({ where: { submissionId_sourceUrl: { submissionId: submission.id, sourceUrl } } })
assert.equal(downloads, 1)
assert.equal(linked.length, 1)
assert.equal(photoJob.status, 'SUCCEEDED')
assert.equal(photoJob.switchImageId, linked[0].id)
assert.equal(cleanupCalls, 0)
assert.deepEqual([...generated], [linked[0].url.replace('/uploads/', '')])
console.log('Partner idempotency E2E PASS: rollback after injected fault, exactly-once concurrency, exact deterministic replay.')
console.log('Partner photo E2E PASS: six concurrent replays performed one download/upload/link with no orphan.')

}

main().finally(() => prisma.$disconnect())
