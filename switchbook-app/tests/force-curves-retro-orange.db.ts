import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { FORCE_CURVE_SOURCE } from '../src/lib/force-curves'
import { catalogMasterCompatibility, linkSourceReviewGroup, resolveUniqueCatalogMaster } from '../src/lib/admin-force-curves'

async function rejected(promise: Promise<unknown>, messages: string[]) {
  await promise.then(() => assert.fail('unsafe operation succeeded'), error => assert.ok(error instanceof Error && messages.includes(error.message), String(error)))
}

async function main() {
  const user=await prisma.user.create({data:{id:'retro-orange-user',email:'retro-orange@example.test',username:'retro-orange-admin',role:'ADMIN'}})
  for(const name of ['KTT','HMX','Gateron']) await prisma.manufacturer.upsert({where:{name},create:{name,aliases:[],verified:true},update:{aliases:[],verified:true}})
  const masters=[
    {id:'retro-orange-right',name:'80Retros GAME1989 Orange',manufacturer:'KTT'},
    {id:'retro-orange-hmx',name:'80Retros GAME1989 Orange',manufacturer:'HMX'},
    {id:'retro-orange-red',name:'80Retros GAME1989 Red',manufacturer:'KTT'},
    {id:'retro-orange-white',name:'80Retros GAME1989 White',manufacturer:'KTT'},
    {id:'retro-orange-blue',name:'80Retros GAME1989 Blue',manufacturer:'KTT'},
    {id:'retro-orange-v2',name:'80Retros GAME1989 Orange V2',manufacturer:'KTT'},
    {id:'retro-orange-unrelated',name:'Oil King',manufacturer:'Gateron'},
  ]
  await prisma.masterSwitch.createMany({data:masters.map(master=>({...master,technology:'MECHANICAL' as const,type:'LINEAR' as const,submittedById:user.id,status:'APPROVED' as const}))})
  const high=await prisma.forceCurveCatalogEntry.create({data:{id:'retro-orange-high',source:FORCE_CURVE_SOURCE,repositoryPath:'80Retros Retro Orange/80Retros_Retro_Orange_HighResolutionRaw.csv',displayName:'80Retros Retro Orange',contentHash:'591e5d3dd396f1052d1e1dc9eff3b0891cc12347',revision:'66cc5aa36208bb33997d3a037137ff60885f5861',exists:true}})
  const raw=await prisma.forceCurveCatalogEntry.create({data:{id:'retro-orange-raw',source:FORCE_CURVE_SOURCE,repositoryPath:'80Retros Retro Orange/80Retros Retro Orange Raw Data CSV.csv',displayName:'80Retros Retro Orange',contentHash:'96d29c279de4c09e2800da09e4a85f38b9bc7a38',revision:'66cc5aa36208bb33997d3a037137ff60885f5861',exists:true}})
  const shapes=[
    {kind:'SOURCE_UNVERIFIED',catalogEntryId:high.id,candidateIds:[high.id]},
    {kind:'MANUFACTURER_CONFLICT',catalogEntryId:raw.id,candidateIds:[raw.id,high.id]},
    {kind:'SOURCE_UNVERIFIED',catalogEntryId:raw.id,candidateIds:[raw.id]},
  ]
  const reviews=await Promise.all(shapes.map((shape,index)=>prisma.forceCurveReviewCase.create({data:{catalogEntryId:shape.catalogEntryId,kind:shape.kind,reason:`Retro Orange production-shaped ${index}`,payload:{measurementKey:'80 retros retro orange 80 retros retro orange',candidateIds:shape.candidateIds}}})))
  const resolution=await resolveUniqueCatalogMaster(prisma,high)
  assert.equal(resolution.uniqueMasterId,masters[0].id)
  const wrongMasters=masters.slice(1,6)
  for(const wrong of wrongMasters) {
    assert.equal(catalogMasterCompatibility(wrong,high,resolution.knownManufacturers).compatible,false)
    await rejected(linkSourceReviewGroup({reviewIds:reviews.map(review=>review.id),masterSwitchId:wrong.id,catalogEntryId:high.id,actorId:user.id},prisma),['INCOMPATIBLE_IDENTITY'])
    assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:wrong.id}}),0)
    assert.equal(await prisma.forceCurveReviewCase.count({where:{id:{in:reviews.map(review=>review.id)},status:'OPEN',masterSwitchId:null}}),3)
  }
  const unrelatedMaster=masters[6]
  const unrelatedCatalog=await prisma.forceCurveCatalogEntry.create({data:{id:'retro-orange-unrelated-catalog',source:FORCE_CURVE_SOURCE,repositoryPath:'Gateron Oil King/TG.csv',displayName:'Gateron Oil King',contentHash:'unrelated-oil-king',revision:'unrelated-revision',technology:'MECHANICAL',exists:true}})
  const unrelatedReview=await prisma.forceCurveReviewCase.create({data:{catalogEntryId:unrelatedCatalog.id,kind:'SOURCE_UNVERIFIED',reason:'Unrelated valid attach control',payload:{measurementKey:'gateron oil king/gateron oil king',candidateIds:[unrelatedCatalog.id]}}})
  const unrelatedResolution=await resolveUniqueCatalogMaster(prisma,unrelatedCatalog)
  assert.equal(unrelatedResolution.uniqueMasterId,unrelatedMaster.id)
  assert.equal(catalogMasterCompatibility(unrelatedMaster,unrelatedCatalog,unrelatedResolution.knownManufacturers).compatible,true)
  assert.deepEqual(await linkSourceReviewGroup({reviewIds:[unrelatedReview.id],masterSwitchId:unrelatedMaster.id,catalogEntryId:unrelatedCatalog.id,actorId:user.id},prisma),{linked:1,masterSwitchId:unrelatedMaster.id,catalogEntryId:unrelatedCatalog.id})
  assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:unrelatedMaster.id,catalogEntryId:unrelatedCatalog.id,state:'MANUALLY_APPROVED'}}),1)
  assert.equal(await prisma.forceCurveReviewCase.count({where:{id:unrelatedReview.id,status:'RESOLVED',resolution:'MANUALLY_APPROVED',masterSwitchId:unrelatedMaster.id,catalogEntryId:unrelatedCatalog.id}}),1)
  const linked=await linkSourceReviewGroup({reviewIds:reviews.map(review=>review.id),masterSwitchId:masters[0].id,catalogEntryId:high.id,actorId:user.id},prisma)
  assert.deepEqual(linked,{linked:3,masterSwitchId:masters[0].id,catalogEntryId:high.id})
  const repeated=await linkSourceReviewGroup({reviewIds:reviews.map(review=>review.id),masterSwitchId:masters[0].id,catalogEntryId:high.id,actorId:user.id},prisma)
  assert.deepEqual(repeated,{linked:3,masterSwitchId:masters[0].id,catalogEntryId:high.id,replayed:true})
  assert.equal(await prisma.forceCurveReviewCase.count({where:{id:{in:reviews.map(review=>review.id)},status:'RESOLVED',resolution:'MANUALLY_APPROVED',masterSwitchId:masters[0].id,catalogEntryId:high.id}}),3)
  assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:masters[0].id,catalogEntryId:high.id,state:'MANUALLY_APPROVED'}}),1)
  assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:{in:wrongMasters.map(master=>master.id)}}}),0)
  console.log(JSON.stringify({exactAlias:true,highOnly:true,rawAndHigh:true,rawOnly:true,wrongCandidatesBlocked:5,negativeReviewMutations:0,unrelatedEnabledAndAttached:true,linked:3,repeatStable:true,rawIncompatibleError:false}))
}

main().finally(()=>prisma.$disconnect())
