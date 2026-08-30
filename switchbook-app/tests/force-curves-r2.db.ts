import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { FORCE_CURVE_SOURCE } from '../src/lib/force-curves'
import { bulkApproveForceCurveReviews, linkSourceReviewGroup, resolveUniqueCatalogMaster } from '../src/lib/admin-force-curves'

async function rejected(promise: Promise<unknown>, messages: string[]) {
  await promise.then(() => assert.fail('unsafe operation succeeded'), error => assert.ok(error instanceof Error && messages.includes(error.message), String(error)))
}

async function main() {
  const user = await prisma.user.upsert({ where: { id: 'fc-user' }, create:{id:'fc-user',email:'fc-r2@example.test',username:'fc-r2-admin',role:'ADMIN'}, update:{} })
  for (const name of ['KTT','HMX','Gateron','BSUN','Aflion']) await prisma.manufacturer.upsert({ where:{name}, create:{name,aliases:[],verified:true}, update:{aliases:[],verified:true} })
  const masters = [
    { id:'cmqo2gr3403wqnu3voig85fi9', name:'80Retros KTT Game1989 Retro Blue', manufacturer:'KTT' },
    { id:'r2-hmx', name:'HMX 80Retros GAME1989', manufacturer:'HMX' },
    { id:'r2-orange', name:'80Retros KTT Game1989 Retro Orange', manufacturer:'KTT' },
    { id:'r2-short', name:'KTT Retro Blue', manufacturer:'KTT' },
    { id:'r2-ktt-gateron', name:'Gateron Oil King', manufacturer:'KTT' },
    { id:'r2-aflion-bsun', name:'BSUN Raw Tactile', manufacturer:'Aflion' },
  ]
  await prisma.masterSwitch.createMany({ data: masters.map(m => ({...m,technology:'MECHANICAL' as const,submittedById:user.id,status:'APPROVED' as const})) })
  const catalog = await prisma.forceCurveCatalogEntry.create({data:{id:'cmtbuy2gk0004uq2nageylhc4',source:FORCE_CURVE_SOURCE,repositoryPath:'80Retros 1989 Retro Blue/80Retros_1989_Retro_Blue_HighResolutionRaw.csv',displayName:'80Retros 1989 Retro Blue',technology:'MECHANICAL',contentHash:'r2-blue',exists:true}})
  const raw = await prisma.forceCurveCatalogEntry.create({data:{id:'cmtbuy2gc0003uq2n00sp53z2',source:FORCE_CURVE_SOURCE,repositoryPath:'80Retros 1989 Retro Blue/80Retros 1989 Retro Blue Raw Data CSV.csv',displayName:'80Retros 1989 Retro Blue',technology:'MECHANICAL',contentHash:'r2-blue-raw',exists:true}})
  const reviewShapes=[
    {kind:'SOURCE_UNVERIFIED',candidateIds:[catalog.id],catalogEntryId:catalog.id},
    {kind:'MANUFACTURER_CONFLICT',candidateIds:[raw.id,catalog.id],catalogEntryId:raw.id},
    {kind:'SOURCE_UNVERIFIED',candidateIds:[raw.id],catalogEntryId:raw.id},
  ]
  const reviews = await Promise.all(reviewShapes.map((shape,i) => prisma.forceCurveReviewCase.create({data:{catalogEntryId:shape.catalogEntryId,kind:shape.kind,reason:`R2 exact evidence ${i}`,payload:{measurementKey:'80Retros 1989 Retro Blue/80retros 1989 retro blue',candidateIds:shape.candidateIds,paths:[shape.catalogEntryId===raw.id?raw.repositoryPath:catalog.repositoryPath]}}})))
  const reviewIds=reviews.map(r=>r.id)
  const linked=await linkSourceReviewGroup({reviewIds,masterSwitchId:masters[0].id,catalogEntryId:catalog.id,actorId:user.id},prisma)
  assert.deepEqual(linked,{linked:3,masterSwitchId:masters[0].id,catalogEntryId:catalog.id})
  const repeated=await linkSourceReviewGroup({reviewIds,masterSwitchId:masters[0].id,catalogEntryId:catalog.id,actorId:user.id},prisma)
  assert.equal(repeated.linked,3)
  assert.equal(await prisma.forceCurveReviewCase.count({where:{id:{in:reviewIds},status:'OPEN',masterSwitchId:masters[0].id,catalogEntryId:catalog.id}}),3)
  assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:{in:masters.map(m=>m.id)}}}),0)
  assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:masters[0].id}}),0)
  assert.equal(await prisma.forceCurveReviewCase.count({where:{id:{in:reviewIds},status:'OPEN'}}),3)

  for (const wrong of masters.slice(1,4)) {
    const review=await prisma.forceCurveReviewCase.create({data:{catalogEntryId:catalog.id,kind:'SOURCE_UNVERIFIED',reason:'R2 wrong variant',payload:{candidateIds:[catalog.id]}}})
    await rejected(linkSourceReviewGroup({reviewIds:[review.id],masterSwitchId:wrong.id,catalogEntryId:catalog.id,actorId:user.id},prisma),['INCOMPATIBLE_IDENTITY'])
    assert.equal((await prisma.forceCurveReviewCase.findUniqueOrThrow({where:{id:review.id}})).masterSwitchId,null)
  }
  for (const fixture of [
    {masterId:'r2-ktt-gateron',id:'r2-gateron-catalog',displayName:'Gateron Oil King'},
    {masterId:'r2-aflion-bsun',id:'r2-bsun-catalog',displayName:'BSUN Raw Tactile'},
  ]) {
    const entry=await prisma.forceCurveCatalogEntry.create({data:{id:fixture.id,source:FORCE_CURVE_SOURCE,repositoryPath:`${fixture.displayName}/TG.csv`,displayName:fixture.displayName,technology:'MECHANICAL',exists:true}})
    const review=await prisma.forceCurveReviewCase.create({data:{catalogEntryId:entry.id,kind:'SOURCE_UNVERIFIED',reason:'R2 cross-maker',payload:{candidateIds:[entry.id]}}})
    await rejected(linkSourceReviewGroup({reviewIds:[review.id],masterSwitchId:fixture.masterId,catalogEntryId:entry.id,actorId:user.id},prisma),['INCOMPATIBLE_IDENTITY'])
  }

  const duplicate=await prisma.masterSwitch.create({data:{id:'r2-blue-duplicate',name:masters[0].name,manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'}})
  assert.equal((await resolveUniqueCatalogMaster(prisma,catalog)).uniqueMasterId,null)
  const ambiguousReview=await prisma.forceCurveReviewCase.create({data:{catalogEntryId:catalog.id,kind:'SOURCE_UNVERIFIED',reason:'R2 ambiguity',payload:{candidateIds:[catalog.id]}}})
  await rejected(linkSourceReviewGroup({reviewIds:[ambiguousReview.id],masterSwitchId:duplicate.id,catalogEntryId:catalog.id,actorId:user.id},prisma),['INCOMPATIBLE_IDENTITY'])
  await prisma.masterSwitch.createMany({data:Array.from({length:201},(_,i)=>({id:`r2-cap-${i}`,name:`CapIdentity ${i}`,manufacturer:'KTT',technology:'MECHANICAL' as const,submittedById:user.id,status:'APPROVED' as const}))})
  const capped=await resolveUniqueCatalogMaster(prisma,{displayName:'CapIdentity',repositoryPath:'CapIdentity/TG.csv',technology:'MECHANICAL'})
  assert.equal(capped.uniqueMasterId,null);assert.match(capped.reason,/more than 200/)
  assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:{in:[...masters.slice(1).map(m=>m.id),duplicate.id]}}}),0)
  console.log(JSON.stringify({migrations:34,exactReviews:3,exactMappings:0,negativeVariants:3,crossMaker:2,ambiguousRejected:1,capCandidates:201,repeatStable:true}))
}
main().finally(()=>prisma.$disconnect())
