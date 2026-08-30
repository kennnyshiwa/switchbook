import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { FORCE_CURVE_SOURCE, getApprovedCurves } from '../src/lib/force-curves'
import { linkSourceReviewGroup, reviewWorkflow } from '../src/lib/admin-force-curves'

async function main() {
  const suffix = `${Date.now()}`
  const fixturePrefix = `Override Naevy ${suffix}`
  const actor = await prisma.user.create({ data: { id: `override-actor-${suffix}`, email: `override-${suffix}@example.test`, username: `override-${suffix}`, role: 'ADMIN' } })
  await prisma.manufacturer.upsert({ where: { name: 'AEBoards' }, create: { name: 'AEBoards', aliases: [], verified: true }, update: { verified: true } })
  await prisma.manufacturer.upsert({ where: { name: 'Tecsee' }, create: { name: 'Tecsee', aliases: [], verified: true }, update: { verified: true } })
  const intended = await prisma.masterSwitch.create({ data: { id: `override-intended-${suffix}`, name: fixturePrefix, manufacturer: 'Tecsee', technology: 'ELECTRO_CAPACITIVE', type: 'TACTILE', submittedById: actor.id, status: 'APPROVED' } })
  const wrong = await prisma.masterSwitch.create({ data: { id: `override-wrong-${suffix}`, name: `${fixturePrefix} V2`, manufacturer: 'Tecsee', technology: 'MECHANICAL', type: 'TACTILE', submittedById: actor.id, status: 'APPROVED' } })
  const automaticCatalog = await prisma.forceCurveCatalogEntry.create({ data: { source: FORCE_CURVE_SOURCE, repositoryPath: `AEBoards ${fixturePrefix} Automatic Guess/${fixturePrefix}_Automatic_HighResolutionRaw.csv`, displayName: `AEBoards ${fixturePrefix} Automatic Guess`, exists: true } })
  const automaticMapping = await prisma.forceCurveMapping.create({ data: { masterSwitchId: intended.id, catalogEntryId: automaticCatalog.id, state: 'AUTO_APPROVED', confidence: 0.5, provenance: 'automatic fixture' } })
  const qualifiers = ['Bottom Out', 'Top Out', '0.5mm', '1mm', '2mm', '3mm']
  const groups: { highId: string; rawId: string; reviewId: string; request: Parameters<typeof linkSourceReviewGroup>[0] }[] = []

  try {
    for (const [index, qualifier] of qualifiers.entries()) {
      const displayName = `AEBoards ${fixturePrefix} ${qualifier}`
      const folder = displayName
      const [raw, high] = await Promise.all([
        prisma.forceCurveCatalogEntry.create({ data: { source: FORCE_CURVE_SOURCE, repositoryPath: `${folder}/${fixturePrefix}_${index}_Raw Data CSV.csv`, displayName, revision: `override-revision-${index}`, contentHash: `override-raw-${index}`, technology: 'ELECTRO_CAPACITIVE', exists: true } }),
        prisma.forceCurveCatalogEntry.create({ data: { source: FORCE_CURVE_SOURCE, repositoryPath: `${folder}/${fixturePrefix}_${index}_HighResolutionRaw.csv`, displayName, revision: `override-revision-${index}`, contentHash: `override-high-${index}`, technology: 'ELECTRO_CAPACITIVE', exists: true } }),
      ])
      const review = await prisma.forceCurveReviewCase.create({ data: { kind: 'SOURCE_UNVERIFIED', reason: `override evidence ${index}`, catalogEntryId: high.id, payload: { measurementKey: `${folder}/${fixturePrefix.toLowerCase()} ${qualifier.toLowerCase()}`, candidateIds: [raw.id, high.id], paths: [raw.repositoryPath, high.repositoryPath] } } })
      const request = { reviewIds: [review.id], masterSwitchId: intended.id, catalogEntryId: high.id, actorId: actor.id, compatibilityOverride: { acknowledged: true as const, reason: `Measurement qualifier ${qualifier} belongs to the canonical Naevy EC product.` } }
      groups.push({ highId: high.id, rawId: raw.id, reviewId: review.id, request })
      assert.deepEqual(await linkSourceReviewGroup(request, prisma), { linked: 1, masterSwitchId: intended.id, catalogEntryId: high.id })
      if (index === 0) assert.deepEqual(await prisma.forceCurveMapping.findUniqueOrThrow({ where: { id: automaticMapping.id }, select: { state: true, reason: true } }), { state: 'STALE', reason: 'Superseded by explicit reviewed source attachment' })
    }

    assert.equal(await prisma.forceCurveMapping.count({ where: { masterSwitchId: intended.id, state: 'MANUALLY_APPROVED' } }), 6)
    assert.equal((await getApprovedCurves(intended.id)).length, 6)
    const resolved = await prisma.forceCurveReviewCase.findMany({ where: { id: { in: groups.map(group => group.reviewId) } }, orderBy: { id: 'asc' } })
    assert.ok(resolved.every(review => review.status === 'RESOLVED' && review.resolution === 'MANUALLY_APPROVED' && reviewWorkflow(review.payload).status === 'ATTACHED'))

    const first = groups[0]
    const beforeMapping = await prisma.forceCurveMapping.findUniqueOrThrow({ where: { masterSwitchId_catalogEntryId: { masterSwitchId: intended.id, catalogEntryId: first.highId } } })
    const beforeReview = await prisma.forceCurveReviewCase.findUniqueOrThrow({ where: { id: first.reviewId } })
    const beforeAudit = JSON.stringify((beforeReview.payload as Record<string, unknown>).linkAudit)
    assert.equal((await linkSourceReviewGroup(first.request, prisma)).replayed, true)
    assert.equal((await linkSourceReviewGroup({ ...first.request, compatibilityOverride: { acknowledged: true, reason: 'Changed retry reason must not replace the original audit.' } }, prisma)).replayed, true)
    const afterMapping = await prisma.forceCurveMapping.findUniqueOrThrow({ where: { masterSwitchId_catalogEntryId: { masterSwitchId: intended.id, catalogEntryId: first.highId } } })
    const afterReview = await prisma.forceCurveReviewCase.findUniqueOrThrow({ where: { id: first.reviewId } })
    assert.deepEqual({ provenance: afterMapping.provenance, reason: afterMapping.reason, decidedAt: afterMapping.decidedAt }, { provenance: beforeMapping.provenance, reason: beforeMapping.reason, decidedAt: beforeMapping.decidedAt })
    assert.equal(JSON.stringify((afterReview.payload as Record<string, unknown>).linkAudit), beforeAudit)
    await assert.rejects(linkSourceReviewGroup({ ...first.request, masterSwitchId: wrong.id }, prisma), /REVIEW_ALREADY_LINKED/)

    const mixedReview = await prisma.forceCurveReviewCase.create({ data: { kind: 'SOURCE_UNVERIFIED', reason: 'mixed-source rejection fixture', catalogEntryId: groups[0].highId, payload: { measurementKey: `${fixturePrefix}/mixed`, candidateIds: [groups[0].highId, groups[0].rawId, groups[1].highId] } } })
    groups.push({ highId: groups[0].highId, rawId: groups[1].highId, reviewId: mixedReview.id, request: { reviewIds: [mixedReview.id], masterSwitchId: intended.id, catalogEntryId: groups[0].highId, actorId: actor.id, compatibilityOverride: { acknowledged: true, reason: 'Must still fail because evidence spans source groups.' } } })
    const mappingsBeforeMixed = await prisma.forceCurveMapping.findMany({ where: { masterSwitchId: intended.id }, select: { id: true, state: true, provenance: true, reason: true, updatedAt: true }, orderBy: { id: 'asc' } })
    const mixedBefore = await prisma.forceCurveReviewCase.findUniqueOrThrow({ where: { id: mixedReview.id } })
    await assert.rejects(linkSourceReviewGroup(groups.at(-1)!.request, prisma), /MIXED_SOURCE_GROUP/)
    assert.deepEqual(await prisma.forceCurveReviewCase.findUniqueOrThrow({ where: { id: mixedReview.id } }), mixedBefore)
    assert.deepEqual(await prisma.forceCurveMapping.findMany({ where: { masterSwitchId: intended.id }, select: { id: true, state: true, provenance: true, reason: true, updatedAt: true }, orderBy: { id: 'asc' } }), mappingsBeforeMixed)
    assert.equal(await prisma.forceCurveMapping.count({ where: { masterSwitchId: intended.id, state: 'MANUALLY_APPROVED' } }), 6)
  } finally {
    await prisma.forceCurveReviewCase.deleteMany({ where: { id: { in: groups.map(group => group.reviewId) } } })
    await prisma.forceCurveMapping.deleteMany({ where: { masterSwitchId: { in: [intended.id, wrong.id] } } })
    await prisma.forceCurveCatalogEntry.deleteMany({ where: { repositoryPath: { startsWith: `AEBoards ${fixturePrefix}` } } })
    await prisma.masterSwitch.deleteMany({ where: { id: { in: [intended.id, wrong.id] } } })
    await prisma.user.delete({ where: { id: actor.id } })
  }
}

main().finally(() => prisma.$disconnect())
