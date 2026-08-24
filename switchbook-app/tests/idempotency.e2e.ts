import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { runIdempotentTransaction, storedPartnerError } from '../src/lib/partner-api/idempotency'
import { PartnerApiError } from '../src/lib/partner-api/errors'
import { associateSubmissionPhotos } from '../src/lib/partner-api/submission-photos'
import { masterSwitchOrderBy } from '../src/lib/master-switch-sort'
import { resolvePartnerCorrection, resolvePartnerSubmission } from '../src/lib/partner-api/moderation'

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

const userId = 'photo-e2e-user'
const masterId = 'photo-e2e-master'
await prisma.$executeRaw`INSERT INTO "User" ("id", "email", "username", "password", "role", "createdAt", "updatedAt", "shareableId") VALUES (${userId}, 'photo-e2e@example.com', 'photo-e2e', 'unused', 'USER', NOW(), NOW(), 'photo-e2e-share')`
await prisma.$executeRaw`INSERT INTO "MasterSwitch" ("id", "name", "manufacturer", "submittedById", "status", "version", "viewCount", "lastModifiedAt", "createdAt", "updatedAt") VALUES (${masterId}, 'Photo E2E', 'E2E', ${userId}, 'PENDING', 1, 0, NOW(), NOW(), NOW())`
const submission = await prisma.partnerSubmission.create({ data: { applicationId: application.id, userId, masterSwitchId: masterId, payload: {}, status: 'SUBMITTED' } })
const sourceUrl = 'https://catalog.example.com/product/photo-e2e'
const remoteUrls = ['https://images.example.com/front.png', 'https://images.example.com/back.png']
await prisma.partnerSubmissionPhoto.createMany({ data: remoteUrls.map((remoteUrl, order) => ({ submissionId: submission.id, remoteUrl, sourceUrl, order })) })
let downloads = 0
let cleanupCalls = 0
const generated = new Set<string>()
const fakeDownload = async (remoteUrl: string) => {
  downloads++
  const pathname = `e2e/${encodeURIComponent(remoteUrl)}.png`
  generated.add(pathname)
  await new Promise(resolve => setTimeout(resolve, 20))
  return { url: `/uploads/${pathname}`, pathname, width: 10, height: 10, size: 100, checksumSha256: remoteUrl.endsWith('front.png') ? 'front-checksum' : 'back-checksum' }
}
const fakeRemove = async (pathname: string) => { cleanupCalls++; generated.delete(pathname) }
const photos = remoteUrls.map((url, index) => ({ url, sourceUrl, alt: `E2E photo ${index + 1}` }))
await Promise.all(Array.from({ length: 6 }, () => associateSubmissionPhotos(submission.id, masterId, photos, fakeDownload, fakeRemove)))
const linked = await prisma.switchImage.findMany({ where: { masterSwitchId: masterId }, orderBy: { order: 'asc' } })
const photoJobs = await prisma.partnerSubmissionPhoto.findMany({ where: { submissionId: submission.id }, orderBy: { order: 'asc' } })
assert.equal(downloads, 2)
assert.equal(linked.length, 2)
assert.equal(photoJobs.length, 2)
assert.deepEqual(linked.map(image => image.remoteUrl), remoteUrls)
assert.deepEqual(linked.map(image => image.sourceUrl), [sourceUrl, sourceUrl])
assert.deepEqual(photoJobs.map(job => job.remoteUrl), remoteUrls)
assert.deepEqual(photoJobs.map(job => job.sourceUrl), [sourceUrl, sourceUrl])
assert.ok(photoJobs.every(job => job.status === 'SUCCEEDED'))
assert.deepEqual(photoJobs.map(job => job.switchImageId), linked.map(image => image.id))
assert.equal(cleanupCalls, 0)
assert.deepEqual(new Set(generated), new Set(linked.map(image => image.url.replace('/uploads/', ''))))

const duplicateSubmission = await prisma.partnerSubmission.create({ data: { applicationId: application.id, userId, masterSwitchId: masterId, payload: {}, status: 'SUBMITTED' } })
const duplicateRemoteUrl = 'https://mirror.example.com/front-copy.png'
await prisma.partnerSubmissionPhoto.create({ data: { submissionId: duplicateSubmission.id, remoteUrl: duplicateRemoteUrl, sourceUrl, order: 0 } })
const duplicateDownload = async () => {
  downloads++
  const pathname = 'e2e/front-copy.png'
  generated.add(pathname)
  return { url: `/uploads/${pathname}`, pathname, width: 10, height: 10, size: 100, checksumSha256: 'front-checksum' }
}
await associateSubmissionPhotos(duplicateSubmission.id, masterId, [{ url: duplicateRemoteUrl, sourceUrl, alt: 'Duplicate binary' }], duplicateDownload, fakeRemove)
const duplicateJob = await prisma.partnerSubmissionPhoto.findUniqueOrThrow({ where: { submissionId_remoteUrl: { submissionId: duplicateSubmission.id, remoteUrl: duplicateRemoteUrl } } })
assert.equal(await prisma.switchImage.count({ where: { masterSwitchId: masterId } }), 2)
assert.equal(duplicateJob.status, 'SUCCEEDED')
assert.equal(duplicateJob.switchImageId, linked[0].id)
assert.equal(cleanupCalls, 1)
assert.equal(generated.has('e2e/front-copy.png'), false)

await prisma.$executeRaw`UPDATE "MasterSwitch" SET "status" = 'APPROVED' WHERE "id" = ${masterId}`
const duplicateCandidates = await prisma.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "MasterSwitch" WHERE "status" = 'APPROVED' AND lower("manufacturer") = lower('E2E') AND "name" ILIKE '%Photo E2E%'`
assert.deepEqual(duplicateCandidates.map(record => record.id), [masterId])
await resolvePartnerSubmission(masterId, 'APPROVED')
const resolvedSubmissions = await prisma.partnerSubmission.findMany({ where: { id: { in: [submission.id, duplicateSubmission.id] } }, orderBy: { id: 'asc' } })
assert.ok(resolvedSubmissions.every(item => item.status === 'APPROVED' && item.masterSwitchId === masterId))

const edit = await prisma.masterSwitchEdit.create({ data: {
  masterSwitchId: masterId, editedById: userId, previousData: { name: 'Photo E2E' },
  newData: { name: 'Photo E2E corrected', editReason: 'E2E correction reason' }, changedFields: ['name'], status: 'PENDING',
} })
const correction = await prisma.partnerCorrection.create({ data: {
  applicationId: application.id, userId, masterSwitchId: masterId, masterSwitchEditId: edit.id,
  changes: { name: 'Photo E2E corrected' }, reason: 'E2E correction reason', status: 'SUBMITTED',
} })
await resolvePartnerCorrection(edit.id, 'APPROVED')
const resolvedCorrection = await prisma.partnerCorrection.findUniqueOrThrow({ where: { id: correction.id } })
assert.equal(resolvedCorrection.status, 'APPROVED')
assert.equal(resolvedCorrection.masterSwitchId, masterId)

const sortIds = Array.from({ length: 7 }, (_, index) => `sort-e2e-${index}`)
for (const [index, id] of sortIds.entries()) {
  await prisma.$executeRaw`INSERT INTO "MasterSwitch" ("id", "name", "manufacturer", "submittedById", "status", "version", "viewCount", "lastModifiedAt", "createdAt", "updatedAt") VALUES (${id}, ${`Sort E2E ${index}`}, 'E2E', ${userId}, 'APPROVED', 1, 100, '2026-01-01', '2026-01-01', '2026-01-01')`
  for (let copy = 0; copy < index % 3; copy++) {
    await prisma.$executeRaw`INSERT INTO "Switch" ("id", "name", "manufacturer", "userId", "masterSwitchId", "createdAt", "updatedAt") VALUES (${`sort-e2e-user-${index}-${copy}`}, ${`Owned ${index}-${copy}`}, 'E2E', ${userId}, ${id}, NOW(), NOW())`
  }
}
for (const sort of ['popular', 'userCount'] as const) {
  const orderBy = masterSwitchOrderBy(sort, 'desc')
  const full = await prisma.masterSwitch.findMany({ where: { id: { in: sortIds } }, orderBy, select: { id: true } })
  const pages = await Promise.all([0, 3, 6].map(skip => prisma.masterSwitch.findMany({
    where: { id: { in: sortIds } }, orderBy, skip, take: 3, select: { id: true },
  })))
  const pagedIds = pages.flat().map(row => row.id)
  assert.deepEqual(pagedIds, full.map(row => row.id), `${sort} pagination must be stable and complete`)
  assert.equal(new Set(pagedIds).size, sortIds.length, `${sort} pagination must not duplicate rows`)
}
console.log('Partner idempotency E2E PASS: rollback after injected fault, exactly-once concurrency, exact deterministic replay.')
console.log('Partner photo E2E PASS: six concurrent replays ingested two remote images from one source page exactly once with no orphan.')
console.log('Partner photo checksum E2E PASS: a different remote URL with identical bytes reused the image and removed the redundant upload.')
console.log('Master switch sort E2E PASS: tied popular/userCount rows paginate in stable order without duplicates or omissions.')
console.log('Partner moderation E2E PASS: duplicate lookup, submission approval/canonical linkage, and correction approval linkage verified.')

}

main().finally(() => prisma.$disconnect())
