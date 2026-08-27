import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { FORCE_CURVE_SOURCE, forceCurveSyncRevision, getApprovedCurves, syncForceCurveCatalog } from '../src/lib/force-curves'
import { recordForceCurveFeedback } from '../src/lib/force-curve-feedback'
import { linkSourceReview, resolveForceCurveReview, verifyReviewMetadata } from '../src/lib/admin-force-curves'

async function main() {
  await prisma.forceCurveFeedback.deleteMany(); await prisma.forceCurveReviewCase.deleteMany(); await prisma.forceCurveMapping.deleteMany(); await prisma.forceCurveCatalogEntry.deleteMany(); await prisma.forceCurveSyncRun.deleteMany(); await prisma.masterSwitch.deleteMany(); await prisma.user.deleteMany()
  const user = await prisma.user.create({ data: { id:'fc-user', email:'fc@example.test', username:'fc-admin', role:'ADMIN' } })
  await prisma.manufacturer.upsert({where:{name:'KTT'},create:{name:'KTT',aliases:[],verified:true},update:{aliases:[],verified:true}})
  await prisma.masterSwitch.createMany({ data: [
    { id:'m-peach', name:'Peach', manufacturer:'KTT', technology:'MECHANICAL', submittedById:user.id, status:'APPROVED' },
    { id:'cmqo21sm103vknu3vh0tjs75x', name:'Peach Blossom', manufacturer:'KTT', technology:'MECHANICAL', submittedById:user.id, status:'APPROVED' }
    ,{ id:'m-feedback', name:'Feedback', manufacturer:'KTT', technology:'MECHANICAL', submittedById:user.id, status:'APPROVED' }
  ] })
  const input = [{ path:'KTT Peach/KTT_Peach_HighResolutionRaw.csv', sha:'a', manufacturer:'KTT', technology:'MECHANICAL' as const, metadataVerified:true, format:'HIGH_RESOLUTION_RAW' as const, measurementKey:'KTT Peach/ktt peach' }]
  const a = await syncForceCurveCatalog('db-rev-a', input, {chunkSize:1}); assert.equal(a.newCount,1); assert.equal((await getApprovedCurves('m-peach')).length,1)
  await prisma.masterSwitch.create({data:{id:'m-atomic',name:'Atomic',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'}})
  const atomicInput = [{path:'KTT Atomic/KTT_Atomic_HighResolutionRaw.csv',sha:'atomic',manufacturer:'KTT',technology:'MECHANICAL' as const,metadataVerified:true,format:'HIGH_RESOLUTION_RAW' as const,measurementKey:'KTT Atomic/ktt atomic'}]
  await syncForceCurveCatalog('atomic-rev',atomicInput,{chunkSize:1,failAfterReconcileChunks:1}).then(()=>assert.fail('expected reconciliation interruption'),()=>undefined)
  const stagedAtomic = await prisma.forceCurveMapping.findFirstOrThrow({where:{masterSwitchId:'m-atomic'}}); assert.equal(stagedAtomic.state,'REVIEW_REQUIRED'); assert.deepEqual(await getApprovedCurves('m-atomic'),[])
  const failedAtomic = await prisma.forceCurveSyncRun.findUniqueOrThrow({where:{source_revision:{source:FORCE_CURVE_SOURCE,revision:'atomic-rev'}}}); assert.equal(failedAtomic.status,'FAILED')
  const resumedAtomic = await syncForceCurveCatalog('atomic-rev',atomicInput,{chunkSize:1}); assert.equal(resumedAtomic.status,'COMPLETED'); assert.equal((await getApprovedCurves('m-atomic')).length,1); assert.equal((await prisma.forceCurveMapping.findFirstOrThrow({where:{masterSwitchId:'m-atomic'}})).state,'AUTO_APPROVED')
  const same = await syncForceCurveCatalog('db-rev-a', input, {chunkSize:1}); assert.equal(same.id,a.id); assert.equal(same.newCount,1)
  const b = await syncForceCurveCatalog('db-rev-b', [{...input[0],sha:'b'}], {chunkSize:1}); assert.equal(b.changedCount,1); assert.ok(b.staleCount>=1); assert.equal((await getApprovedCurves('m-peach')).length,0); assert.equal((await prisma.forceCurveMapping.findFirstOrThrow({where:{masterSwitchId:'m-peach'}})).state,'STALE')
  await syncForceCurveCatalog('resume-rev', [{path:'one/TG.csv',sha:'1'},{path:'two/TG.csv',sha:'2'}], {chunkSize:1,failAfterChunks:1}).then(()=>assert.fail('expected interruption'),()=>undefined)
  const failed = await prisma.forceCurveSyncRun.findUniqueOrThrow({where:{source_revision:{source:FORCE_CURVE_SOURCE,revision:'resume-rev'}}}); assert.equal(failed.status,'FAILED'); assert.equal(failed.cursor,'1'); assert.equal(failed.errorCount,1)
  const resumed = await syncForceCurveCatalog('resume-rev', [{path:'one/TG.csv',sha:'1'},{path:'two/TG.csv',sha:'2'}], {chunkSize:1}); assert.equal(resumed.status,'COMPLETED'); assert.equal(resumed.cursor,'2')
  const catalogs = await prisma.forceCurveCatalogEntry.findMany({where:{repositoryPath:{in:['one/TG.csv','two/TG.csv']}}}); assert.equal(catalogs.length,2)
  await prisma.forceCurveMapping.createMany({data:catalogs.map((c,i)=>({masterSwitchId:'m-peach',catalogEntryId:c.id,state:'MANUALLY_APPROVED' as const,provenance:`manual-${i}`}))}); assert.equal((await getApprovedCurves('m-peach')).length,2)
  await prisma.forceCurveMapping.create({data:{masterSwitchId:'m-peach',state:'NO_MATCH',noMatchKey:'m-peach',provenance:'manual'}}); assert.equal((await getApprovedCurves('m-peach')).length,0)
  await prisma.forceCurveMapping.create({data:{masterSwitchId:'m-peach',state:'NO_MATCH',noMatchKey:'m-peach',provenance:'duplicate'}}).then(()=>assert.fail('duplicate no-match accepted'),()=>undefined)
  await syncForceCurveCatalog('peach-regression', [{path:'KTT Peach Blossom/KTT_Peach_Blossom_HighResolutionRaw.csv',sha:'pb',manufacturer:'KTT',technology:'MECHANICAL',metadataVerified:true,format:'HIGH_RESOLUTION_RAW',measurementKey:'KTT Peach Blossom/ktt peach blossom'}]); assert.deepEqual(await getApprovedCurves('cmqo21sm103vknu3vh0tjs75x'),[])
  const peachNoMatch = await prisma.forceCurveMapping.findUnique({where:{noMatchKey:'cmqo21sm103vknu3vh0tjs75x'}}); assert.equal(peachNoMatch?.state,'NO_MATCH')
  await prisma.manufacturer.upsert({where:{name:'Cherry'},create:{name:'Cherry',aliases:[],verified:true},update:{aliases:[],verified:true}})
  await prisma.masterSwitch.createMany({data:[
    {id:'m-wrong-maker',name:'Wrong Maker',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'},
    {id:'m-wrong-tech',name:'Wrong Tech',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'},
    {id:'m-duplicate-a',name:'Duplicate',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'},
    {id:'m-duplicate-b',name:'Duplicate',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'},
    {id:'m-equal',name:'Equal',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'},
    {id:'m-manual',name:'Manual Durable',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'},
    {id:'m-rejected',name:'Rejected Durable',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'},
  ]})
  const durableCatalogs = await Promise.all([
    ['manual-catalog','KTT Manual Durable/KTT_Manual_Durable_HighResolutionRaw.csv','KTT Manual Durable'],
    ['rejected-catalog','KTT Rejected Durable/KTT_Rejected_Durable_HighResolutionRaw.csv','KTT Rejected Durable'],
  ].map(([id,repositoryPath,displayName])=>prisma.forceCurveCatalogEntry.create({data:{id,source:FORCE_CURVE_SOURCE,repositoryPath,displayName,contentHash:`sha-${id}`,exists:true}})))
  await prisma.forceCurveMapping.createMany({data:[
    {masterSwitchId:'m-manual',catalogEntryId:durableCatalogs[0].id,state:'MANUALLY_APPROVED',provenance:'manual-durable'},
    {masterSwitchId:'m-rejected',catalogEntryId:durableCatalogs[1].id,state:'REJECTED',provenance:'rejected-durable'},
  ]})
  const conflictFixtures = [
    {path:'KTT Wrong Maker/KTT_Wrong_Maker_HighResolutionRaw.csv',sha:'wrong-maker',manufacturer:'Cherry',technology:'MECHANICAL' as const,metadataVerified:true,format:'HIGH_RESOLUTION_RAW' as const,measurementKey:'KTT Wrong Maker/ktt wrong maker'},
    {path:'KTT Wrong Tech/KTT_Wrong_Tech_HighResolutionRaw.csv',sha:'wrong-tech',manufacturer:'KTT',technology:'MAGNETIC' as const,metadataVerified:true,format:'HIGH_RESOLUTION_RAW' as const,measurementKey:'KTT Wrong Tech/ktt wrong tech'},
    {path:'KTT Duplicate/KTT_Duplicate_HighResolutionRaw.csv',sha:'duplicate',manufacturer:'KTT',technology:'MECHANICAL' as const,metadataVerified:true,format:'HIGH_RESOLUTION_RAW' as const,measurementKey:'KTT Duplicate/ktt duplicate'},
    {path:'KTT Equal/KTT_Equal_HighResolutionRaw.csv',sha:'equal-a',manufacturer:'KTT',technology:'MECHANICAL' as const,metadataVerified:true,format:'HIGH_RESOLUTION_RAW' as const,measurementKey:'KTT Equal/ktt equal'},
    {path:'KTT Equal/KTT Equal_HighResolutionRaw.csv',sha:'equal-b',manufacturer:'KTT',technology:'MECHANICAL' as const,metadataVerified:true,format:'HIGH_RESOLUTION_RAW' as const,measurementKey:'KTT Equal/ktt equal'},
    {path:durableCatalogs[0].repositoryPath,sha:'sha-manual-catalog',format:'HIGH_RESOLUTION_RAW' as const,measurementKey:'KTT Manual Durable/ktt manual durable'},
    {path:durableCatalogs[1].repositoryPath,sha:'sha-rejected-catalog',format:'HIGH_RESOLUTION_RAW' as const,measurementKey:'KTT Rejected Durable/ktt rejected durable'},
  ]
  await syncForceCurveCatalog('conflict-fixtures',conflictFixtures)
  assert.ok(await prisma.forceCurveReviewCase.findFirst({where:{kind:'INSUFFICIENT_EVIDENCE',masterSwitchId:'m-wrong-maker',status:'OPEN'}}))
  assert.ok(await prisma.forceCurveReviewCase.findFirst({where:{kind:'TECHNOLOGY_CONFLICT',masterSwitchId:'m-wrong-tech',status:'OPEN'}}))
  assert.ok(await prisma.forceCurveReviewCase.findFirst({where:{kind:'AMBIGUOUS',catalogEntry:{displayName:'KTT Duplicate'},status:'OPEN'}}))
  assert.ok(await prisma.forceCurveReviewCase.findFirst({where:{kind:'AMBIGUOUS',masterSwitchId:'m-equal',status:'OPEN'}}))
  assert.equal((await prisma.forceCurveMapping.findUniqueOrThrow({where:{id:(await prisma.forceCurveMapping.findFirstOrThrow({where:{masterSwitchId:'m-manual'}})).id}})).state,'MANUALLY_APPROVED')
  assert.equal((await prisma.forceCurveMapping.findFirstOrThrow({where:{masterSwitchId:'m-rejected'}})).state,'REJECTED')
  await prisma.masterSwitch.create({data:{id:'m-algorithm',name:'Algorithm',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'}})
  await prisma.forceCurveSyncRun.create({data:{source:FORCE_CURVE_SOURCE,revision:'algorithm-upstream:formats-v2',status:'COMPLETED',cursor:'1',beforeCount:0,afterCount:1,completedAt:new Date()}})
  const algorithmInput = [{path:'KTT Algorithm/KTT_Algorithm_HighResolutionRaw.csv',sha:'algorithm-sha',format:'HIGH_RESOLUTION_RAW' as const,measurementKey:'KTT Algorithm/ktt algorithm'}]
  const algorithmRun = await syncForceCurveCatalog(forceCurveSyncRevision('algorithm-upstream'),algorithmInput,{catalogRevision:'algorithm-upstream'})
  assert.equal(algorithmRun.revision,'algorithm-upstream:formats-v3:exact-match-v1')
  assert.equal((await prisma.forceCurveMapping.findFirstOrThrow({where:{masterSwitchId:'m-algorithm'}})).state,'AUTO_APPROVED')
  const algorithmState = {
    mappings:await prisma.forceCurveMapping.findMany({select:{id:true,state:true,updatedAt:true},orderBy:{id:'asc'}}),
    reviews:await prisma.forceCurveReviewCase.findMany({select:{id:true,status:true,updatedAt:true},orderBy:{id:'asc'}}),
    catalog:await prisma.forceCurveCatalogEntry.findMany({select:{id:true,updatedAt:true},orderBy:{id:'asc'}}),
  }
  const algorithmRerun = await syncForceCurveCatalog(forceCurveSyncRevision('algorithm-upstream'),algorithmInput,{catalogRevision:'algorithm-upstream'})
  assert.equal(algorithmRerun.id,algorithmRun.id)
  assert.deepEqual({
    mappings:await prisma.forceCurveMapping.findMany({select:{id:true,state:true,updatedAt:true},orderBy:{id:'asc'}}),
    reviews:await prisma.forceCurveReviewCase.findMany({select:{id:true,status:true,updatedAt:true},orderBy:{id:'asc'}}),
    catalog:await prisma.forceCurveCatalogEntry.findMany({select:{id:true,updatedAt:true},orderBy:{id:'asc'}}),
  },algorithmState)
  const feedbackCatalog = await prisma.forceCurveCatalogEntry.create({data:{source:FORCE_CURVE_SOURCE,repositoryPath:'KTT Feedback/TG.csv',displayName:'KTT Feedback',manufacturer:'KTT',technology:'MECHANICAL',exists:true}})
  await prisma.forceCurveMapping.create({data:{masterSwitchId:'m-feedback',catalogEntryId:feedbackCatalog.id,state:'AUTO_APPROVED',provenance:'fixture'}})
  const feedback = await recordForceCurveFeedback({userId:user.id,masterSwitchId:'m-feedback',catalogEntryId:feedbackCatalog.id,switchName:'Feedback',manufacturer:'KTT',incorrectMatch:'KTT Feedback/TG.csv',feedbackType:'no_match_found'})
  assert.ok(feedback.reviewCaseId); assert.equal((await prisma.forceCurveMapping.findFirstOrThrow({where:{masterSwitchId:'m-feedback',catalogEntryId:feedbackCatalog.id}})).state,'REVIEW_REQUIRED'); assert.equal((await prisma.forceCurveReviewCase.findUniqueOrThrow({where:{id:feedback.reviewCaseId!}})).kind,'FEEDBACK')
  const review = await prisma.forceCurveReviewCase.create({data:{masterSwitchId:'m-feedback',kind:'UNMATCHED',reason:'fixture',payload:{candidateIds:[]}}})
  await prisma.$transaction([prisma.forceCurveCatalogEntry.update({where:{id:feedbackCatalog.id},data:{manufacturer:'KTT',technology:'MECHANICAL',metadataVerifiedAt:new Date(),metadataVerifiedById:user.id}}),prisma.forceCurveReviewCase.update({where:{id:review.id},data:{catalogEntryId:feedbackCatalog.id,payload:{candidateIds:[feedbackCatalog.id],metadataVerification:{verifiedById:user.id}}}})])
  const verified = await prisma.forceCurveCatalogEntry.findUniqueOrThrow({where:{id:feedbackCatalog.id}}); assert.equal(verified.metadataVerifiedById,user.id); assert.ok(verified.metadataVerifiedAt)
  const workflowSamples = [
    {masterId:'cmcj8nlk20001ju04hkhn73i4',catalogId:'cmtbuybf90197uq2ni7cm18gf',name:'Gateron Oil King',technology:'MECHANICAL' as const,path:'Gateron Oil King/Gateron_Oil_King_HighResolutionRaw.csv'},
    {masterId:'cmgwp60xy04jwpk2om25iv882',catalogId:'cmtbuybn801aluq2njayzle8l',name:'Gateron Smoothie',technology:'MECHANICAL' as const,path:'Gateron Smoothie/Gateron_Smoothie_HighResolutionRaw.csv'},
    {masterId:'cmgwnyflm04blpk2ow1uibj03',catalogId:'cmtbuyb5e017kuq2nqlgwl087',name:'Gateron Magnetic Jade',technology:'MAGNETIC' as const,path:'Gateron Magnetic Jade/Gateron_Magnetic_Jade_HighResolutionRaw.csv'},
    {masterId:'cmgloohl501vfpk2os8do5jwo',catalogId:'cmtbuyaip0140uq2n2z0pe3ws',name:'Gateron G Pro 3.0 Yellow',technology:'MECHANICAL' as const,path:'Gateron G Pro 3.0 Yellow/Gateron_G_Pro_3.0_Yellow_HighResolutionRaw.csv'},
  ]
  let firstWorkflow: {reviewId:string;catalogId:string;masterId:string}|undefined
  for (const sample of workflowSamples) {
    await prisma.masterSwitch.create({data:{id:sample.masterId,name:sample.name,manufacturer:'Gateron',technology:sample.technology,submittedById:user.id,status:'APPROVED'}})
    const catalog = await prisma.forceCurveCatalogEntry.create({data:{id:sample.catalogId,source:FORCE_CURVE_SOURCE,repositoryPath:sample.path,displayName:sample.name,revision:'exact',contentHash:`blob-${sample.catalogId}`,exists:true}})
    const review = await prisma.forceCurveReviewCase.create({data:{catalogEntryId:catalog.id,kind:'SOURCE_UNVERIFIED',reason:'source metadata absent',payload:{candidateIds:[catalog.id]}}})
    const linked = await linkSourceReview({reviewId:review.id,masterSwitchId:sample.masterId,catalogEntryId:catalog.id,actorId:user.id},prisma); assert.equal(linked.masterSwitchId,sample.masterId); assert.match(JSON.stringify(linked.payload),/linkAudit/)
    const linkedAgain = await linkSourceReview({reviewId:review.id,masterSwitchId:sample.masterId,catalogEntryId:catalog.id,actorId:user.id},prisma); assert.equal(linkedAgain.id,linked.id); assert.equal(await prisma.forceCurveReviewCase.count({where:{id:review.id}}),1)
    await verifyReviewMetadata({reviewId:review.id,catalogEntryId:catalog.id,manufacturer:'Gateron',technology:sample.technology,actorId:user.id},prisma)
    await resolveForceCurveReview({reviewId:review.id,resolution:'MANUALLY_APPROVED',catalogEntryId:catalog.id,actorId:user.id},prisma)
    const mapping = await prisma.forceCurveMapping.findUniqueOrThrow({where:{masterSwitchId_catalogEntryId:{masterSwitchId:sample.masterId,catalogEntryId:catalog.id}}}); assert.equal(mapping.decidedById,user.id); assert.ok(mapping.decidedAt); assert.match(mapping.provenance,/"source":"github:ThereminGoat\/force-curves"/); assert.equal((await getApprovedCurves(sample.masterId)).length,1)
    firstWorkflow ||= {reviewId:review.id,catalogId:catalog.id,masterId:sample.masterId}
  }
  await resolveForceCurveReview({reviewId:firstWorkflow!.reviewId,resolution:'MANUALLY_APPROVED',catalogEntryId:firstWorkflow!.catalogId,actorId:user.id},prisma).then(()=>assert.fail('resolved review accepted twice'),()=>undefined); assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:firstWorkflow!.masterId,catalogEntryId:firstWorkflow!.catalogId}}),1)
  const raceMaster = await prisma.masterSwitch.create({data:{id:'m-link-race',name:'Gateron Race',manufacturer:'Gateron',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'}})
  const raceCatalog = await prisma.forceCurveCatalogEntry.create({data:{source:FORCE_CURVE_SOURCE,repositoryPath:'Gateron Race/Gateron_Race_HighResolutionRaw.csv',displayName:'Gateron Race',revision:'race',contentHash:'race-blob',exists:true}})
  const raceReviews = await Promise.all([0,1].map(i=>prisma.forceCurveReviewCase.create({data:{catalogEntryId:raceCatalog.id,kind:'SOURCE_UNVERIFIED',reason:`race ${i}`,payload:{candidateIds:[raceCatalog.id]}}})))
  const raceResults = await Promise.allSettled(raceReviews.map(item=>linkSourceReview({reviewId:item.id,masterSwitchId:raceMaster.id,catalogEntryId:raceCatalog.id,actorId:user.id},prisma)))
  assert.equal(raceResults.filter(result=>result.status==='fulfilled').length,1)
  const rejectedRace = raceResults.find(result=>result.status==='rejected'); assert.equal(rejectedRace?.status,'rejected'); assert.equal(rejectedRace.status==='rejected'&&rejectedRace.reason instanceof Error?rejectedRace.reason.message:null,'CONFLICTING_OPEN_REVIEW')
  assert.equal(await prisma.forceCurveReviewCase.count({where:{status:'OPEN',masterSwitchId:raceMaster.id,catalogEntryId:raceCatalog.id}}),1)
  const raceWinner = await prisma.forceCurveReviewCase.findFirstOrThrow({where:{status:'OPEN',masterSwitchId:raceMaster.id,catalogEntryId:raceCatalog.id}})
  const repeatedRaceWinner = await linkSourceReview({reviewId:raceWinner.id,masterSwitchId:raceMaster.id,catalogEntryId:raceCatalog.id,actorId:user.id},prisma); assert.equal(repeatedRaceWinner.id,raceWinner.id); assert.equal(await prisma.forceCurveReviewCase.count({where:{status:'OPEN',masterSwitchId:raceMaster.id,catalogEntryId:raceCatalog.id}}),1)
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
