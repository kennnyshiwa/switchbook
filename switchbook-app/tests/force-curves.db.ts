import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { FORCE_CURVE_SOURCE, getApprovedCurves, syncForceCurveCatalog } from '../src/lib/force-curves'
import { recordForceCurveFeedback } from '../src/lib/force-curve-feedback'

async function main() {
  await prisma.forceCurveFeedback.deleteMany(); await prisma.forceCurveReviewCase.deleteMany(); await prisma.forceCurveMapping.deleteMany(); await prisma.forceCurveCatalogEntry.deleteMany(); await prisma.forceCurveSyncRun.deleteMany(); await prisma.masterSwitch.deleteMany(); await prisma.user.deleteMany()
  const user = await prisma.user.create({ data: { id:'fc-user', email:'fc@example.test', username:'fc-admin', role:'ADMIN' } })
  await prisma.masterSwitch.createMany({ data: [
    { id:'m-peach', name:'Peach', manufacturer:'KTT', technology:'MECHANICAL', submittedById:user.id, status:'APPROVED' },
    { id:'cmqo21sm103vknu3vh0tjs75x', name:'Peach Blossom', manufacturer:'KTT', technology:'MECHANICAL', submittedById:user.id, status:'APPROVED' }
    ,{ id:'m-feedback', name:'Feedback', manufacturer:'KTT', technology:'MECHANICAL', submittedById:user.id, status:'APPROVED' }
  ] })
  const input = [{ path:'KTT Peach/TG.csv', sha:'a', manufacturer:'KTT', technology:'MECHANICAL' as const, metadataVerified:true }]
  const a = await syncForceCurveCatalog('db-rev-a', input, {chunkSize:1}); assert.equal(a.newCount,1); assert.equal((await getApprovedCurves('m-peach')).length,1)
  const same = await syncForceCurveCatalog('db-rev-a', input, {chunkSize:1}); assert.equal(same.id,a.id); assert.equal(same.newCount,1)
  const b = await syncForceCurveCatalog('db-rev-b', [{...input[0],sha:'b'}], {chunkSize:1}); assert.equal(b.changedCount,1); assert.ok(b.staleCount>=1); assert.equal((await getApprovedCurves('m-peach')).length,0); assert.equal((await prisma.forceCurveMapping.findFirstOrThrow({where:{masterSwitchId:'m-peach'}})).state,'STALE')
  await syncForceCurveCatalog('resume-rev', [{path:'one/TG.csv',sha:'1'},{path:'two/TG.csv',sha:'2'}], {chunkSize:1,failAfterChunks:1}).then(()=>assert.fail('expected interruption'),()=>undefined)
  const failed = await prisma.forceCurveSyncRun.findUniqueOrThrow({where:{source_revision:{source:FORCE_CURVE_SOURCE,revision:'resume-rev'}}}); assert.equal(failed.status,'FAILED'); assert.equal(failed.cursor,'1'); assert.equal(failed.errorCount,1)
  const resumed = await syncForceCurveCatalog('resume-rev', [{path:'one/TG.csv',sha:'1'},{path:'two/TG.csv',sha:'2'}], {chunkSize:1}); assert.equal(resumed.status,'COMPLETED'); assert.equal(resumed.cursor,'2')
  const catalogs = await prisma.forceCurveCatalogEntry.findMany({where:{repositoryPath:{in:['one/TG.csv','two/TG.csv']}}}); assert.equal(catalogs.length,2)
  await prisma.forceCurveMapping.createMany({data:catalogs.map((c,i)=>({masterSwitchId:'m-peach',catalogEntryId:c.id,state:'MANUALLY_APPROVED' as const,provenance:`manual-${i}`}))}); assert.equal((await getApprovedCurves('m-peach')).length,2)
  await prisma.forceCurveMapping.create({data:{masterSwitchId:'m-peach',state:'NO_MATCH',noMatchKey:'m-peach',provenance:'manual'}}); assert.equal((await getApprovedCurves('m-peach')).length,0)
  await prisma.forceCurveMapping.create({data:{masterSwitchId:'m-peach',state:'NO_MATCH',noMatchKey:'m-peach',provenance:'duplicate'}}).then(()=>assert.fail('duplicate no-match accepted'),()=>undefined)
  await syncForceCurveCatalog('peach-regression', [{path:'KTT Peach Blossom/TG.csv',sha:'pb',manufacturer:'KTT',technology:'MECHANICAL',metadataVerified:true}]); assert.deepEqual(await getApprovedCurves('cmqo21sm103vknu3vh0tjs75x'),[])
  const peachNoMatch = await prisma.forceCurveMapping.findUnique({where:{noMatchKey:'cmqo21sm103vknu3vh0tjs75x'}}); assert.equal(peachNoMatch?.state,'NO_MATCH')
  const feedbackCatalog = await prisma.forceCurveCatalogEntry.create({data:{source:FORCE_CURVE_SOURCE,repositoryPath:'KTT Feedback/TG.csv',displayName:'KTT Feedback',manufacturer:'KTT',technology:'MECHANICAL',exists:true}})
  await prisma.forceCurveMapping.create({data:{masterSwitchId:'m-feedback',catalogEntryId:feedbackCatalog.id,state:'AUTO_APPROVED',provenance:'fixture'}})
  const feedback = await recordForceCurveFeedback({userId:user.id,masterSwitchId:'m-feedback',catalogEntryId:feedbackCatalog.id,switchName:'Feedback',manufacturer:'KTT',incorrectMatch:'KTT Feedback/TG.csv',feedbackType:'no_match_found'})
  assert.ok(feedback.reviewCaseId); assert.equal((await prisma.forceCurveMapping.findFirstOrThrow({where:{masterSwitchId:'m-feedback',catalogEntryId:feedbackCatalog.id}})).state,'REVIEW_REQUIRED'); assert.equal((await prisma.forceCurveReviewCase.findUniqueOrThrow({where:{id:feedback.reviewCaseId!}})).kind,'FEEDBACK')
  const review = await prisma.forceCurveReviewCase.create({data:{masterSwitchId:'m-feedback',kind:'UNMATCHED',reason:'fixture',payload:{candidateIds:[]}}})
  await prisma.$transaction([prisma.forceCurveCatalogEntry.update({where:{id:feedbackCatalog.id},data:{manufacturer:'KTT',technology:'MECHANICAL',metadataVerifiedAt:new Date(),metadataVerifiedById:user.id}}),prisma.forceCurveReviewCase.update({where:{id:review.id},data:{catalogEntryId:feedbackCatalog.id,payload:{candidateIds:[feedbackCatalog.id],metadataVerification:{verifiedById:user.id}}}})])
  const verified = await prisma.forceCurveCatalogEntry.findUniqueOrThrow({where:{id:feedbackCatalog.id}}); assert.equal(verified.metadataVerifiedById,user.id); assert.ok(verified.metadataVerifiedAt)
  await prisma.forceCurveReviewCase.createMany({data:[
    {masterSwitchId:'m-peach',kind:'UNMATCHED',reason:'legacy empty-catalog noise',payload:{candidateIds:[]}},
    {masterSwitchId:'m-feedback',kind:'UNMATCHED',reason:'legacy empty-catalog noise',payload:{candidateIds:[]}},
  ]})
  const modern = [
    {path:"'X' Green/'X' Green Raw Data CSV.csv",sha:'7be19f',format:'RAW_DATA' as const,measurementKey:"'X' Green/x green"},
    {path:"'X' Green/'X'_Green_HighResolutionRaw.csv",sha:'82bcbe',format:'HIGH_RESOLUTION_RAW' as const,measurementKey:"'X' Green/x green"},
    {path:'Solo/Solo Raw Data CSV.csv',sha:'solo',format:'RAW_DATA' as const,measurementKey:'Solo/solo'},
    {path:'BSUN Avocado Panda V2/BSUN Avocado Panda V2.csv',sha:'legacy',format:'NONSTANDARD_REVIEW' as const,measurementKey:'BSUN Avocado Panda V2/bsun avocado panda v2'},
    {path:'KTT Peach Sun/KTT_Peach_Sun_HighResolutionRaw.csv',sha:'sun',format:'HIGH_RESOLUTION_RAW' as const,measurementKey:'KTT Peach Sun/ktt peach sun'},
  ]
  await prisma.forceCurveSyncRun.create({data:{source:FORCE_CURVE_SOURCE,revision:'66cc5aa',status:'COMPLETED',cursor:'0',beforeCount:0,afterCount:0,unmatchedCount:3,reviewCount:3,completedAt:new Date()}})
  const formats = await syncForceCurveCatalog('66cc5aa:formats-v2',modern,{chunkSize:2,catalogRevision:'66cc5aa'}); assert.equal(formats.afterCount,modern.length); assert.equal(formats.newCount,modern.length)
  const paired = await prisma.forceCurveCatalogEntry.findMany({where:{repositoryPath:{startsWith:"'X' Green/"}},orderBy:{repositoryPath:'asc'}}); assert.equal(paired.length,2); assert.deepEqual(paired.map(row=>row.contentHash).sort(),['7be19f','82bcbe']); assert.ok(paired.every(row=>row.revision==='66cc5aa'))
  const pairReview = await prisma.forceCurveReviewCase.findFirstOrThrow({where:{catalogEntryId:{in:paired.map(row=>row.id)},kind:'SOURCE_UNVERIFIED'}}); assert.deepEqual((pairReview.payload as {candidateIds:string[]}).candidateIds.length,2)
  assert.equal(await prisma.forceCurveReviewCase.count({where:{kind:'UNMATCHED',status:'OPEN'}}),0)
  const reviewCount = await prisma.forceCurveReviewCase.count({where:{kind:{in:['SOURCE_UNVERIFIED','SOURCE_NONSTANDARD']},status:'OPEN'}})
  const repeated = await syncForceCurveCatalog('66cc5aa:formats-v2',modern,{chunkSize:2,catalogRevision:'66cc5aa'}); assert.equal(repeated.id,formats.id); assert.equal(await prisma.forceCurveReviewCase.count({where:{kind:{in:['SOURCE_UNVERIFIED','SOURCE_NONSTANDARD']},status:'OPEN'}}),reviewCount)
  await syncForceCurveCatalog('66cc5ab:formats-v2',modern,{chunkSize:2,catalogRevision:'66cc5ab'}); assert.equal(await prisma.forceCurveReviewCase.count({where:{kind:{in:['SOURCE_UNVERIFIED','SOURCE_NONSTANDARD']},status:'OPEN'}}),reviewCount)

  // Production-shaped upstream cardinality: 2,622 paired measurements plus 107
  // singletons = 5,351 catalog blobs and exactly 2,729 durable review groups.
  const upstream = Array.from({length:2622},(_,i) => {
    const key = `Exact Pair ${i}/exact pair ${i}`
    return [
      {path:`Exact Pair ${i}/Exact Pair ${i} Raw Data CSV.csv`,sha:`raw-${i}`,format:'RAW_DATA' as const,measurementKey:key},
      {path:`Exact Pair ${i}/Exact_Pair_${i}_HighResolutionRaw.csv`,sha:`hi-${i}`,format:'HIGH_RESOLUTION_RAW' as const,measurementKey:key},
    ]
  }).flat().concat(Array.from({length:107},(_,i)=>({path:`Exact Solo ${i}/Exact Solo ${i} Raw Data CSV.csv`,sha:`solo-${i}`,format:'RAW_DATA' as const,measurementKey:`Exact Solo ${i}/exact solo ${i}`})))
  const concurrentRevision = 'exact-upstream:formats-v2'
  const concurrent = await Promise.all([
    syncForceCurveCatalog(concurrentRevision,upstream,{chunkSize:250,catalogRevision:'exact-upstream'}),
    syncForceCurveCatalog(concurrentRevision,upstream,{chunkSize:250,catalogRevision:'exact-upstream'}),
  ])
  assert.equal(concurrent[0].id,concurrent[1].id); assert.equal(concurrent[0].status,'COMPLETED'); assert.equal(concurrent[1].status,'COMPLETED')
  assert.equal(concurrent[0].cursor,'5351'); assert.equal(concurrent[1].cursor,'5351'); assert.equal(concurrent[0].errorCount,0); assert.equal(concurrent[1].errorCount,0)
  assert.equal(concurrent[0].afterCount,5351); assert.equal(concurrent[0].reviewCount,2729); assert.equal(concurrent[1].reviewCount,2729)
  assert.equal(await prisma.forceCurveSyncRun.count({where:{source:FORCE_CURVE_SOURCE,revision:concurrentRevision}}),1)
  assert.equal(await prisma.forceCurveReviewCase.count({where:{status:'OPEN',kind:{in:['SOURCE_UNVERIFIED','SOURCE_NONSTANDARD']},catalogEntry:{source:FORCE_CURVE_SOURCE,exists:true,revision:'exact-upstream'}}}),2729)
  const decisionsBeforeRepair = await prisma.forceCurveMapping.findMany({select:{id:true,state:true,provenance:true,reason:true},orderBy:{id:'asc'}})
  await prisma.forceCurveSyncRun.update({where:{id:concurrent[0].id},data:{reviewCount:0}})
  const repaired = await syncForceCurveCatalog(concurrentRevision,upstream,{chunkSize:250,catalogRevision:'exact-upstream'}); assert.equal(repaired.reviewCount,2729)
  assert.deepEqual(await prisma.forceCurveMapping.findMany({select:{id:true,state:true,provenance:true,reason:true},orderBy:{id:'asc'}}),decisionsBeforeRepair)
  assert.equal((await syncForceCurveCatalog(concurrentRevision,upstream,{chunkSize:250,catalogRevision:'exact-upstream'})).reviewCount,2729)
  assert.deepEqual(await getApprovedCurves('cmqo21sm103vknu3vh0tjs75x'),[])
  console.log(JSON.stringify({runs:await prisma.forceCurveSyncRun.count(),catalog:await prisma.forceCurveCatalogEntry.count(),reviews:await prisma.forceCurveReviewCase.count(),peachApprovedUrls:(await getApprovedCurves('cmqo21sm103vknu3vh0tjs75x')).map(x=>x.url)},null,2))
}
main().finally(()=>prisma.$disconnect())
