import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { FORCE_CURVE_SOURCE } from '../src/lib/force-curves'
import { linkSourceReviewGroup, resolveUniqueCatalogMaster, reviewWorkflow } from '../src/lib/admin-force-curves'

async function main() {
  const suffix = `${Date.now()}`
  const actor = await prisma.user.create({ data: { id: `agarwood-actor-${suffix}`, email: `agarwood-${suffix}@example.test`, username: `agarwood-${suffix}`, role: 'ADMIN' } })
  await prisma.manufacturer.upsert({ where: { name: 'Bsun' }, create: { name: 'Bsun', aliases: ['BSUN'], verified: true }, update: { aliases: ['BSUN'], verified: true } })
  const intended = await prisma.masterSwitch.create({ data: { id: `agarwood-intended-${suffix}`, name: 'BSUN Agarwood', manufacturer: 'Bsun', technology: null, type: 'LINEAR', submittedById: actor.id, status: 'APPROVED' } })
  const wrong = await prisma.masterSwitch.create({ data: { id: `agarwood-wrong-${suffix}`, name: 'BSUN Agarwood Pro', manufacturer: 'Bsun', technology: 'MECHANICAL', type: 'LINEAR', submittedById: actor.id, status: 'APPROVED' } })
  const labels = ['BSUN Agarwood 1', 'BSUN Agarwood 2', 'BSUN Agarwood 3', 'BSUN Agarwood 4', 'BSUN Agarwood 10k Actuations', 'BSUN Agarwood 100k Actuations']
  const catalogIds:string[]=[]; const reviewIds:string[]=[]; const selectedIds:string[]=[]
  let unrelatedId = ''
  try {
    for (const [index, displayName] of labels.entries()) {
      const measurementKey = `BSUN Agarwood/${displayName.toLowerCase()}`
      const raw = await prisma.forceCurveCatalogEntry.create({ data: { source: FORCE_CURVE_SOURCE, repositoryPath: `BSUN Agarwood/${displayName} Raw.csv`, displayName, revision: `agarwood-${index}`, contentHash: `raw-${suffix}-${index}`, exists: true } })
      const high = await prisma.forceCurveCatalogEntry.create({ data: { source: FORCE_CURVE_SOURCE, repositoryPath: `BSUN Agarwood/${displayName} HighResolutionRaw.csv`, displayName, revision: `agarwood-${index}`, contentHash: `high-${suffix}-${index}`, exists: true } })
      catalogIds.push(raw.id, high.id); selectedIds.push(high.id)
      const rows = await Promise.all(['SOURCE_UNVERIFIED', 'SOURCE_UNVERIFIED', 'AMBIGUOUS'].map((kind, row) => prisma.forceCurveReviewCase.create({ data: { kind, reason: `Agarwood ${kind} ${row}`, catalogEntryId: high.id, payload: { measurementKey, candidateIds: [raw.id, high.id], paths: [raw.repositoryPath, high.repositoryPath] } } })))
      reviewIds.push(...rows.map(row => row.id))
      const request = { reviewIds: rows.map(row => row.id), masterSwitchId: intended.id, catalogEntryId: high.id, actorId: actor.id }
      const resolution = await resolveUniqueCatalogMaster(prisma, high)
      assert.equal(resolution.uniqueMasterId, intended.id, `${displayName}: ${resolution.reason}`)
      if (index === 0) {
        const before = await prisma.forceCurveReviewCase.findMany({ where: { id: { in: request.reviewIds } }, orderBy: { id: 'asc' } })
        await assert.rejects(linkSourceReviewGroup({ ...request, reviewIds: request.reviewIds.slice(0, 2) }, prisma), /INCOMPLETE_SOURCE_GROUP/)
        assert.deepEqual(await prisma.forceCurveReviewCase.findMany({ where: { id: { in: request.reviewIds } }, orderBy: { id: 'asc' } }), before)
      }
      assert.deepEqual(await linkSourceReviewGroup(request, prisma), { linked: 3, masterSwitchId: intended.id, catalogEntryId: high.id })
      assert.equal((await linkSourceReviewGroup(request, prisma)).replayed, true)
    }

    unrelatedId = (await prisma.forceCurveReviewCase.create({ data: { kind: 'OTHER', reason: 'unrelated deferred sibling', payload: { measurementKey: 'BSUN Agarwood/unrelated', candidateIds: [selectedIds[0]], queueWorkflow: { status: 'DEFERRED', reason: 'preserve me' } } } })).id
    const unrelatedBefore = await prisma.forceCurveReviewCase.findUniqueOrThrow({ where: { id: unrelatedId } })
    const changedCatalog = await prisma.forceCurveCatalogEntry.create({ data: { source: FORCE_CURVE_SOURCE, repositoryPath: 'BSUN Agarwood/BSUN Agarwood 9 missing.csv', displayName: 'BSUN Agarwood 9', exists: false } })
    catalogIds.push(changedCatalog.id)
    const changedRows = await Promise.all(['SOURCE_UNVERIFIED', 'AMBIGUOUS'].map(kind => prisma.forceCurveReviewCase.create({ data: { kind, reason: 'changed catalog evidence', catalogEntryId: selectedIds[0], payload: { measurementKey: 'BSUN Agarwood/changed', candidateIds: [selectedIds[0], changedCatalog.id] } } })))
    reviewIds.push(...changedRows.map(row => row.id))
    const changedBefore = await prisma.forceCurveReviewCase.findMany({ where: { id: { in: changedRows.map(row => row.id) } }, orderBy: { id: 'asc' } })
    await assert.rejects(linkSourceReviewGroup({ reviewIds: changedRows.map(row => row.id), masterSwitchId: intended.id, catalogEntryId: selectedIds[0], actorId: actor.id }, prisma), /REVIEW_CANDIDATE_REQUIRED/)
    assert.deepEqual(await prisma.forceCurveReviewCase.findMany({ where: { id: { in: changedRows.map(row => row.id) } }, orderBy: { id: 'asc' } }), changedBefore)
    const invalidSource = await prisma.forceCurveReviewCase.create({ data: { kind: 'SOURCE_UNVERIFIED', reason: 'invalid group source row', catalogEntryId: selectedIds[0], payload: { measurementKey: 'BSUN Agarwood/invalid', candidateIds: [selectedIds[0]] } } })
    const invalidOther = await prisma.forceCurveReviewCase.create({ data: { kind: 'OTHER', reason: 'invalid group unrelated kind', catalogEntryId: selectedIds[0], payload: { measurementKey: 'BSUN Agarwood/invalid', candidateIds: [selectedIds[0]] } } })
    reviewIds.push(invalidSource.id, invalidOther.id)
    await assert.rejects(linkSourceReviewGroup({ reviewIds: [invalidSource.id, invalidOther.id], masterSwitchId: intended.id, catalogEntryId: selectedIds[0], actorId: actor.id }, prisma), /REVIEW_CANDIDATE_REQUIRED/)
    assert.deepEqual(await prisma.forceCurveReviewCase.findUniqueOrThrow({ where: { id: unrelatedId } }), unrelatedBefore)

    assert.equal(await prisma.forceCurveMapping.count({ where: { masterSwitchId: intended.id, state: 'MANUALLY_APPROVED', catalogEntryId: { in: selectedIds } } }), 6)
    assert.equal(await prisma.forceCurveMapping.count({ where: { masterSwitchId: wrong.id } }), 0)
    assert.equal(await prisma.forceCurveMapping.count({ where: { catalogEntryId: { in: catalogIds.filter(id => !selectedIds.includes(id)) } } }), 0)
    const resolved = await prisma.forceCurveReviewCase.findMany({ where: { id: { in: reviewIds.slice(0, 18) } } })
    assert.equal(resolved.length, 18)
    assert.ok(resolved.every(row => row.status === 'RESOLVED' && row.resolution === 'MANUALLY_APPROVED' && row.masterSwitchId === intended.id && reviewWorkflow(row.payload).status === 'ATTACHED'))
    assert.ok(resolved.every(row => !((row.payload as Record<string, any>).linkAudit?.compatibilityOverride)))
    console.log('PASS BSUN Agarwood six-shape grouped attachment: 18/18 rows resolved atomically')
  } finally {
    await prisma.forceCurveReviewCase.deleteMany({ where: { id: { in: [...reviewIds, ...(unrelatedId ? [unrelatedId] : [])] } } })
    await prisma.forceCurveMapping.deleteMany({ where: { masterSwitchId: { in: [intended.id, wrong.id] } } })
    await prisma.forceCurveCatalogEntry.deleteMany({ where: { id: { in: catalogIds } } })
    await prisma.masterSwitch.deleteMany({ where: { id: { in: [intended.id, wrong.id] } } })
    await prisma.user.delete({ where: { id: actor.id } })
  }
}

main().finally(() => prisma.$disconnect())
