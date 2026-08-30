import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { FORCE_CURVE_SOURCE } from '../src/lib/force-curves'
import { linkSourceReviewGroup } from '../src/lib/admin-force-curves'

async function main() {
  const suffix = `${Date.now()}`
  const actor = await prisma.user.create({ data: { id: `override-actor-${suffix}`, email: `override-${suffix}@example.test`, username: `override-${suffix}`, role: 'ADMIN' } })
  await prisma.manufacturer.upsert({ where: { name: 'AEBoards' }, create: { name: 'AEBoards', aliases: [], verified: true }, update: { verified: true } })
  await prisma.manufacturer.upsert({ where: { name: 'Tecsee' }, create: { name: 'Tecsee', aliases: [], verified: true }, update: { verified: true } })
  const intended = await prisma.masterSwitch.create({ data: { id: `override-intended-${suffix}`, name: 'Naevy EC', manufacturer: 'Tecsee', technology: 'ELECTRO_CAPACITIVE', type: 'TACTILE', submittedById: actor.id, status: 'APPROVED' } })
  const wrong = await prisma.masterSwitch.create({ data: { id: `override-wrong-${suffix}`, name: 'Naevy EC V2', manufacturer: 'Tecsee', technology: 'MECHANICAL', type: 'TACTILE', submittedById: actor.id, status: 'APPROVED' } })
  const catalog = await prisma.forceCurveCatalogEntry.create({ data: { source: FORCE_CURVE_SOURCE, repositoryPath: 'AEBoards Naevy EC Bottom Out/AEBoards_Naevy_EC_Bottom_Out_HighResolutionRaw.csv', displayName: 'AEBoards Naevy EC Bottom Out', revision: 'override-fixture-revision', contentHash: 'override-fixture-hash', technology: 'ELECTRO_CAPACITIVE', exists: true } })
  const reviews = await Promise.all([1, 2].map(index => prisma.forceCurveReviewCase.create({ data: { kind: 'SOURCE_UNVERIFIED', reason: `override evidence ${index}`, catalogEntryId: catalog.id, payload: { measurementKey: 'AEBoards Naevy EC Bottom Out/ae boards naevy ec', candidateIds: [catalog.id], paths: [catalog.repositoryPath] } } })))

  try {
    const request = { reviewIds: reviews.map(review => review.id), masterSwitchId: intended.id, catalogEntryId: catalog.id, actorId: actor.id, compatibilityOverride: { acknowledged: true as const, reason: 'Folder suffix is a measurement qualifier for the canonical Naevy EC product.' } }
    assert.deepEqual(await linkSourceReviewGroup(request, prisma), { linked: 2, masterSwitchId: intended.id, catalogEntryId: catalog.id })
    const beforeMapping = await prisma.forceCurveMapping.findUniqueOrThrow({ where: { masterSwitchId_catalogEntryId: { masterSwitchId: intended.id, catalogEntryId: catalog.id } } })
    const beforeReviews = await prisma.forceCurveReviewCase.findMany({ where: { id: { in: reviews.map(review => review.id) } }, orderBy: { id: 'asc' } })
    const beforeAudit = beforeReviews.map(review => JSON.stringify((review.payload as Record<string, unknown>).linkAudit))
    assert.match(beforeMapping.provenance, /Folder suffix is a measurement qualifier/)
    assert.match(beforeMapping.provenance, /override-fixture-hash/)

    assert.equal((await linkSourceReviewGroup(request, prisma)).replayed, true)
    assert.equal((await linkSourceReviewGroup({ ...request, compatibilityOverride: { acknowledged: true, reason: 'A different retry reason must never replace the original audit.' } }, prisma)).replayed, true)

    const afterMapping = await prisma.forceCurveMapping.findUniqueOrThrow({ where: { masterSwitchId_catalogEntryId: { masterSwitchId: intended.id, catalogEntryId: catalog.id } } })
    const afterReviews = await prisma.forceCurveReviewCase.findMany({ where: { id: { in: reviews.map(review => review.id) } }, orderBy: { id: 'asc' } })
    assert.equal(afterMapping.provenance, beforeMapping.provenance)
    assert.equal(afterMapping.reason, beforeMapping.reason)
    assert.equal(afterMapping.decidedAt?.toISOString(), beforeMapping.decidedAt?.toISOString())
    assert.deepEqual(afterReviews.map(review => JSON.stringify((review.payload as Record<string, unknown>).linkAudit)), beforeAudit)
    assert.deepEqual(afterReviews.map(review => review.resolvedAt?.toISOString()), beforeReviews.map(review => review.resolvedAt?.toISOString()))

    await assert.rejects(linkSourceReviewGroup({ ...request, masterSwitchId: wrong.id }, prisma), /REVIEW_ALREADY_LINKED/)
  } finally {
    await prisma.forceCurveReviewCase.deleteMany({ where: { id: { in: reviews.map(review => review.id) } } })
    await prisma.forceCurveMapping.deleteMany({ where: { OR: [{ masterSwitchId: intended.id }, { masterSwitchId: wrong.id }] } })
    await prisma.forceCurveCatalogEntry.delete({ where: { id: catalog.id } })
    await prisma.masterSwitch.deleteMany({ where: { id: { in: [intended.id, wrong.id] } } })
    await prisma.user.delete({ where: { id: actor.id } })
  }
}

main().finally(() => prisma.$disconnect())
