import assert from 'node:assert/strict'
import { prisma } from '../src/lib/prisma'
import { FORCE_CURVE_SOURCE, forceCurveSyncRevision, getApprovedCurves, syncForceCurveCatalog } from '../src/lib/force-curves'
import { recordForceCurveFeedback } from '../src/lib/force-curve-feedback'
import { bulkApproveForceCurveReviews, buildReviewQueue, deferForceCurveReviews, linkSourceReview, linkSourceReviewGroup, resolveForceCurveReview, resolveNoMatchGroup, verifyReviewMetadata } from '../src/lib/admin-force-curves'
import { getForceCurveReviewQueuePage, invalidateForceCurveReviewQueue } from '../src/lib/admin-force-curve-queue'

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
  const beforeAtomic = {approved:await getApprovedCurves('m-atomic'),open:await prisma.forceCurveReviewCase.count({where:{status:'OPEN'}})}
  await syncForceCurveCatalog('atomic-rev',atomicInput,{chunkSize:1,failAfterReconcileChunks:1}).then(()=>assert.fail('expected reconciliation interruption'),()=>undefined)
  assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:'m-atomic'}}),0); assert.deepEqual(await getApprovedCurves('m-atomic'),beforeAtomic.approved); assert.equal(await prisma.forceCurveReviewCase.count({where:{status:'OPEN'}}),beforeAtomic.open); assert.ok(await prisma.forceCurveSyncStage.findFirst({where:{run:{revision:'atomic-rev'},outputType:'MAPPING'}}))
  const failedAtomic = await prisma.forceCurveSyncRun.findUniqueOrThrow({where:{source_revision:{source:FORCE_CURVE_SOURCE,revision:'atomic-rev'}}}); assert.equal(failedAtomic.status,'FAILED')
  const resumedAtomic = await syncForceCurveCatalog('atomic-rev',atomicInput,{chunkSize:1}); assert.equal(resumedAtomic.status,'COMPLETED'); assert.equal((await getApprovedCurves('m-atomic')).length,1); assert.equal((await prisma.forceCurveMapping.findFirstOrThrow({where:{masterSwitchId:'m-atomic'}})).state,'AUTO_APPROVED')
  await prisma.masterSwitch.create({data:{id:'m-legacy-recovery',name:'Legacy Recovery',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'}})
  const legacyPath = 'KTT Legacy Recovery/KTT_Legacy_Recovery_HighResolutionRaw.csv'
  const legacyCatalog = await prisma.forceCurveCatalogEntry.create({data:{id:'legacy-recovery-catalog',source:FORCE_CURVE_SOURCE,repositoryPath:legacyPath,displayName:'KTT Legacy Recovery',revision:'legacy-recovery',contentHash:'legacy-recovery-sha',manufacturer:'KTT',technology:'MECHANICAL',metadataVerifiedAt:new Date(),exists:true}})
  const legacyRun = await prisma.forceCurveSyncRun.create({data:{id:'legacy-recovery-run',source:FORCE_CURVE_SOURCE,revision:'legacy-recovery',status:'FAILED',cursor:'1',beforeCount:1,errorCount:1}})
  const legacyProvenance = JSON.stringify({source:FORCE_CURVE_SOURCE,revision:'legacy-recovery',syncRunId:legacyRun.id,rule:'exact-path-identity-v1',measurementKey:'KTT Legacy Recovery/ktt legacy recovery',manufacturer:'KTT',contentHash:'legacy-recovery-sha'})
  await prisma.forceCurveMapping.create({data:{masterSwitchId:'m-legacy-recovery',catalogEntryId:legacyCatalog.id,state:'REVIEW_REQUIRED',confidence:1,provenance:legacyProvenance}})
  const legacyReview = await prisma.forceCurveReviewCase.create({data:{catalogEntryId:legacyCatalog.id,kind:'SOURCE_UNVERIFIED',reason:'legacy partial release',payload:{candidateIds:[legacyCatalog.id]}}})
  await prisma.masterSwitch.createMany({data:[
    {id:'m-legacy-unrelated',name:'Legacy Unrelated',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'},
    {id:'m-legacy-manual',name:'Legacy Manual',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'},
    {id:'m-legacy-malformed',name:'Legacy Malformed',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'},
  ]})
  const ownershipCatalogs = await Promise.all(['unrelated','manual','malformed'].map(label=>prisma.forceCurveCatalogEntry.create({data:{id:`legacy-${label}-catalog`,source:FORCE_CURVE_SOURCE,repositoryPath:`Legacy ${label}/TG.csv`,displayName:`Legacy ${label}`,revision:'ownership-fixture',contentHash:`${label}-sha`,exists:true}})))
  await prisma.forceCurveMapping.createMany({data:[
    {masterSwitchId:'m-legacy-unrelated',catalogEntryId:ownershipCatalogs[0].id,state:'REVIEW_REQUIRED',provenance:JSON.stringify({syncRunId:'different-run'})},
    {masterSwitchId:'m-legacy-manual',catalogEntryId:ownershipCatalogs[1].id,state:'REVIEW_REQUIRED',provenance:'manual-review'},
    {masterSwitchId:'m-legacy-malformed',catalogEntryId:ownershipCatalogs[2].id,state:'REVIEW_REQUIRED',provenance:`garbage {"syncRunId":"${legacyRun.id}"} trailing`},
  ]})
  const malformedReview = await prisma.forceCurveReviewCase.create({data:{catalogEntryId:ownershipCatalogs[2].id,kind:'SOURCE_UNVERIFIED',reason:'must remain open',payload:{candidateIds:[ownershipCatalogs[2].id]}}})
  const recoveredLegacy = await syncForceCurveCatalog('legacy-recovery',[{path:legacyPath,sha:'legacy-recovery-sha',manufacturer:'KTT',technology:'MECHANICAL',metadataVerified:true,format:'HIGH_RESOLUTION_RAW',measurementKey:'KTT Legacy Recovery/ktt legacy recovery'}],{chunkSize:1})
  assert.equal((await prisma.forceCurveMapping.findFirstOrThrow({where:{masterSwitchId:'m-legacy-recovery'}})).state,'AUTO_APPROVED'); assert.equal((await prisma.forceCurveReviewCase.findUniqueOrThrow({where:{id:legacyReview.id}})).status,'RESOLVED'); assert.equal(await prisma.forceCurveReviewCase.count({where:{catalogEntryId:legacyCatalog.id,kind:'SOURCE_UNVERIFIED'}}),1); assert.equal(recoveredLegacy.reviewCount,0)
  for (const masterSwitchId of ['m-legacy-unrelated','m-legacy-manual','m-legacy-malformed']) assert.equal((await prisma.forceCurveMapping.findFirstOrThrow({where:{masterSwitchId}})).state,'REVIEW_REQUIRED')
  assert.equal((await prisma.forceCurveReviewCase.findUniqueOrThrow({where:{id:malformedReview.id}})).status,'OPEN')
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
  const largeFailureBaseline = {
    mappings:await prisma.forceCurveMapping.findMany({select:{id:true,state:true,provenance:true},orderBy:{id:'asc'}}),
    open:await prisma.forceCurveReviewCase.count({where:{status:'OPEN'}}),
  }
  await syncForceCurveCatalog('large-failure:formats-v2',upstream,{chunkSize:50,failAfterReconcileChunks:3,catalogRevision:'large-failure'}).then(()=>assert.fail('expected large reconciliation interruption'),()=>undefined)
  assert.deepEqual(await prisma.forceCurveMapping.findMany({select:{id:true,state:true,provenance:true},orderBy:{id:'asc'}}),largeFailureBaseline.mappings)
  assert.equal(await prisma.forceCurveReviewCase.count({where:{status:'OPEN'}}),largeFailureBaseline.open)
  assert.equal(await prisma.forceCurveSyncStage.count({where:{run:{revision:'large-failure:formats-v2'}}}),300)
  const resumedLarge = await syncForceCurveCatalog('large-failure:formats-v2',upstream,{chunkSize:50,catalogRevision:'large-failure'}); assert.equal(resumedLarge.status,'COMPLETED'); assert.equal(resumedLarge.cursor,'5351')
  const resumedLargeState = {mappings:await prisma.forceCurveMapping.count(),open:await prisma.forceCurveReviewCase.count({where:{status:'OPEN'}})}
  assert.equal((await syncForceCurveCatalog('large-failure:formats-v2',upstream,{chunkSize:50,catalogRevision:'large-failure'})).id,resumedLarge.id)
  assert.deepEqual({mappings:await prisma.forceCurveMapping.count(),open:await prisma.forceCurveReviewCase.count({where:{status:'OPEN'}})},resumedLargeState)
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
  // Source-centric queue mutations are durable, replay-safe, atomic, and publish only approved decisions.
  const queueMaster=await prisma.masterSwitch.create({data:{id:'m-queue-db',name:'Queue DB',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'}})
  const queueCatalog=await prisma.forceCurveCatalogEntry.create({data:{id:'queue-db-catalog',source:FORCE_CURVE_SOURCE,repositoryPath:'KTT Queue DB/KTT_Queue_DB_HighResolutionRaw.csv',displayName:'KTT Queue DB',contentHash:'queue-db-sha',exists:true}})
  const queueReviews=await Promise.all([1,2].map(i=>prisma.forceCurveReviewCase.create({data:{masterSwitchId:queueMaster.id,catalogEntryId:queueCatalog.id,kind:'SOURCE_UNVERIFIED',reason:`queue evidence ${i}`,payload:{measurementKey:'KTT Queue DB/ktt queue db',candidateIds:[queueCatalog.id],paths:[queueCatalog.repositoryPath]}}})))
  assert.deepEqual(await getApprovedCurves(queueMaster.id),[])
  assert.equal((await deferForceCurveReviews({reviewIds:queueReviews.map(r=>r.id),actorId:user.id},prisma)).deferred,2)
  assert.equal((await deferForceCurveReviews({reviewIds:queueReviews.map(r=>r.id),actorId:user.id},prisma)).replayed,true)
  const approved=await bulkApproveForceCurveReviews({reviewIds:queueReviews.map(r=>r.id),catalogEntryId:queueCatalog.id,actorId:user.id},prisma);assert.equal(approved.approved,2);assert.equal((await getApprovedCurves(queueMaster.id)).length,1)
  assert.equal((await bulkApproveForceCurveReviews({reviewIds:queueReviews.map(r=>r.id),catalogEntryId:queueCatalog.id,actorId:user.id},prisma)).replayed,true)
  const ambiguousCatalog=await prisma.forceCurveCatalogEntry.create({data:{id:'queue-db-ambiguous',source:FORCE_CURVE_SOURCE,repositoryPath:'KTT Queue DB/alternate.csv',displayName:'KTT Queue DB',contentHash:'queue-db-alt',exists:true}})
  await bulkApproveForceCurveReviews({reviewIds:queueReviews.map(r=>r.id),catalogEntryId:ambiguousCatalog.id,actorId:user.id},prisma).then(()=>assert.fail('altered replay accepted'),error=>assert.equal((error as Error).message,'UNSAFE_BULK_APPROVAL'))
  const ambiguousReview=await prisma.forceCurveReviewCase.create({data:{masterSwitchId:queueMaster.id,catalogEntryId:queueCatalog.id,kind:'AMBIGUOUS',reason:'two candidates',payload:{measurementKey:'KTT Queue DB/ambiguous',candidateIds:[queueCatalog.id,ambiguousCatalog.id]}}})
  await bulkApproveForceCurveReviews({reviewIds:[ambiguousReview.id],catalogEntryId:queueCatalog.id,actorId:user.id},prisma).then(()=>assert.fail('unsafe ambiguity approved'),error=>assert.equal((error as Error).message,'UNSAFE_BULK_APPROVAL'))
  assert.equal((await prisma.forceCurveReviewCase.findUniqueOrThrow({where:{id:ambiguousReview.id}})).status,'OPEN')
  const noMatchReviews=await Promise.all([1,2].map(i=>prisma.forceCurveReviewCase.create({data:{masterSwitchId:queueMaster.id,kind:'UNMATCHED',reason:`no match ${i}`,payload:{measurementKey:'KTT Queue DB/no match',candidateIds:[]}}})))
  assert.equal((await resolveNoMatchGroup({reviewIds:noMatchReviews.map(r=>r.id),actorId:user.id},prisma)).resolved,2);assert.deepEqual(await getApprovedCurves(queueMaster.id),[])
  assert.equal((await resolveNoMatchGroup({reviewIds:noMatchReviews.map(r=>r.id),actorId:user.id},prisma)).replayed,true)
  const unlinkedMaster=await prisma.masterSwitch.create({data:{id:'m-group-link',name:'Group Link',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'}})
  const unlinkedCatalog=await prisma.forceCurveCatalogEntry.create({data:{id:'group-link-catalog',source:FORCE_CURVE_SOURCE,repositoryPath:'KTT Group Link/KTT_Group_Link_HighResolutionRaw.csv',displayName:'KTT Group Link',contentHash:'group-link-sha',exists:true}})
  const staleCatalog=await prisma.forceCurveCatalogEntry.create({data:{id:'group-link-stale',source:FORCE_CURVE_SOURCE,repositoryPath:'KTT Group Link/old.csv',displayName:'KTT Group Link',contentHash:'group-link-old',exists:true}})
  await prisma.forceCurveMapping.create({data:{masterSwitchId:unlinkedMaster.id,catalogEntryId:staleCatalog.id,state:'AUTO_APPROVED',confidence:1,provenance:'automatic mapping to supersede'}})
  const staleHistory=await prisma.forceCurveReviewCase.create({data:{masterSwitchId:unlinkedMaster.id,catalogEntryId:staleCatalog.id,kind:'SOURCE_UNVERIFIED',status:'RESOLVED',resolution:'REJECTED',resolvedById:user.id,resolvedAt:new Date(),reason:'older stale history',payload:{candidateIds:[staleCatalog.id]}}})
  const unlinked=await Promise.all([1,2,3].map(i=>prisma.forceCurveReviewCase.create({data:{catalogEntryId:unlinkedCatalog.id,kind:'SOURCE_UNVERIFIED',reason:`unlinked evidence ${i}`,payload:{candidateIds:[unlinkedCatalog.id]}}})))
  const beforeLinkQueue=buildReviewQueue([{...staleHistory,masterSwitch:unlinkedMaster,candidates:[staleCatalog]},...unlinked.map(r=>({...r,masterSwitch:null,candidates:[unlinkedCatalog]}))]);assert.equal(beforeLinkQueue.uniqueSourceCount,1);assert.ok(unlinked.some(r=>r.id===beforeLinkQueue.items[0].primaryReviewId))
  assert.equal((await linkSourceReviewGroup({reviewIds:unlinked.map(r=>r.id),masterSwitchId:unlinkedMaster.id,catalogEntryId:unlinkedCatalog.id,actorId:user.id},prisma)).linked,3)
  const linkedRows=await prisma.forceCurveReviewCase.findMany({where:{id:{in:unlinked.map(r=>r.id)}},include:{masterSwitch:true}});assert.ok(linkedRows.every(r=>r.masterSwitchId===unlinkedMaster.id&&r.status==='RESOLVED'&&r.resolution==='MANUALLY_APPROVED'&&(r.payload as any).queueWorkflow.status==='ATTACHED'&&(r.payload as any).linkAudit.masterSwitchId===unlinkedMaster.id))
  assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:unlinkedMaster.id,catalogEntryId:unlinkedCatalog.id,state:'MANUALLY_APPROVED'}}),1)
  assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:unlinkedMaster.id,catalogEntryId:staleCatalog.id,state:'STALE',reason:'Superseded by exact manual source attachment'}}),1)
  const linkedQueue=buildReviewQueue(linkedRows.map(r=>({...r,candidates:[unlinkedCatalog]})));assert.equal(linkedQueue.uniqueSourceCount,1);assert.equal(linkedQueue.openSourceCount,0);assert.equal(linkedQueue.resolvedSourceCount,1);assert.equal(linkedQueue.remainingActionable,0)
  invalidateForceCurveReviewQueue(prisma)
  const openAfterAttach=await getForceCurveReviewQueuePage({status:'OPEN',query:'KTT Group Link',page:9,pageSize:1},prisma);assert.equal(openAfterAttach.filteredSourceCount,0);assert.equal(openAfterAttach.pagination.page,1);assert.equal(openAfterAttach.pagination.pageCount,1)
  const historyAfterAttach=await getForceCurveReviewQueuePage({status:'RESOLVED',query:'KTT Group Link',pageSize:1},prisma);assert.equal(historyAfterAttach.filteredSourceCount,1);assert.equal(historyAfterAttach.items[0].attached,true);assert.ok(historyAfterAttach.items[0].evidence.every(row=>row.status==='RESOLVED'))
  const attachedSnapshot=JSON.stringify(await prisma.forceCurveReviewCase.findMany({where:{id:{in:unlinked.map(r=>r.id)}},orderBy:{id:'asc'}}))
  const catalogSnapshot=JSON.stringify(await prisma.forceCurveCatalogEntry.findUniqueOrThrow({where:{id:unlinkedCatalog.id}}))
  const immutableError=async(operation:Promise<unknown>)=>operation.then(()=>assert.fail('attached review mutated'),error=>assert.equal((error as Error).message,'ATTACHED_REVIEW_IMMUTABLE'))
  await immutableError(deferForceCurveReviews({reviewIds:unlinked.map(r=>r.id),actorId:user.id},prisma))
  await immutableError(bulkApproveForceCurveReviews({reviewIds:unlinked.map(r=>r.id),catalogEntryId:unlinkedCatalog.id,actorId:user.id},prisma))
  await immutableError(resolveNoMatchGroup({reviewIds:unlinked.map(r=>r.id),actorId:user.id},prisma))
  await immutableError(linkSourceReview({reviewId:unlinked[0].id,masterSwitchId:unlinkedMaster.id,catalogEntryId:unlinkedCatalog.id,actorId:user.id},prisma))
  await immutableError(verifyReviewMetadata({reviewId:unlinked[0].id,catalogEntryId:unlinkedCatalog.id,manufacturer:'KTT',technology:'MECHANICAL',actorId:user.id},prisma))
  await immutableError(resolveForceCurveReview({reviewId:unlinked[0].id,resolution:'MANUALLY_APPROVED',catalogEntryId:unlinkedCatalog.id,actorId:user.id},prisma))
  assert.equal(JSON.stringify(await prisma.forceCurveReviewCase.findMany({where:{id:{in:unlinked.map(r=>r.id)}},orderBy:{id:'asc'}})),attachedSnapshot)
  assert.equal(JSON.stringify(await prisma.forceCurveCatalogEntry.findUniqueOrThrow({where:{id:unlinkedCatalog.id}})),catalogSnapshot)
  assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:unlinkedMaster.id}}),2)
  // Production-shaped 80Retros group: repeated raw/high-resolution evidence may
  // include one MANUFACTURER_CONFLICT diagnostic for the same canonical source.
  const exact80Master=await prisma.masterSwitch.create({data:{id:'m-80retros-r2-db',name:'80Retros QAExact KTT Game1989 Retro Blue',manufacturer:'KTT',technology:'MECHANICAL',submittedById:user.id,status:'APPROVED'}})
  const exact80Raw=await prisma.forceCurveCatalogEntry.create({data:{id:'c-80retros-r2-raw',source:FORCE_CURVE_SOURCE,repositoryPath:'80Retros QAExact 1989 Retro Blue/raw.csv',displayName:'80Retros QAExact 1989 Retro Blue',contentHash:'80-r2-raw',exists:true}})
  const exact80High=await prisma.forceCurveCatalogEntry.create({data:{id:'c-80retros-r2-high',source:FORCE_CURVE_SOURCE,repositoryPath:'80Retros QAExact 1989 Retro Blue/high.csv',displayName:'80Retros QAExact 1989 Retro Blue',contentHash:'80-r2-high',exists:true}})
  const exact80Key='80Retros QAExact 1989 Retro Blue/80retros qaexact 1989 retro blue'
  const exact80Reviews=await Promise.all([
    ['SOURCE_UNVERIFIED',[exact80Raw.id]],
    ['MANUFACTURER_CONFLICT',[exact80Raw.id,exact80High.id]],
    ['SOURCE_UNVERIFIED',[exact80High.id]],
  ].map(([kind,ids],i)=>prisma.forceCurveReviewCase.create({data:{id:`r-80retros-r2-${i}`,catalogEntryId:exact80High.id,kind:kind as string,reason:'production-shaped exact source',payload:{measurementKey:exact80Key,candidateIds:ids}}})))
  const exact80Before=JSON.stringify(await prisma.forceCurveReviewCase.findMany({where:{id:{in:exact80Reviews.map(r=>r.id)}},orderBy:{id:'asc'}}))
  await linkSourceReviewGroup({reviewIds:[exact80Reviews[1].id],masterSwitchId:exact80Master.id,catalogEntryId:exact80High.id,actorId:user.id},prisma).then(()=>assert.fail('one-row subset attached'),error=>assert.equal((error as Error).message,'INCOMPLETE_SOURCE_GROUP'))
  await linkSourceReviewGroup({reviewIds:exact80Reviews.slice(1).map(r=>r.id),masterSwitchId:exact80Master.id,catalogEntryId:exact80High.id,actorId:user.id},prisma).then(()=>assert.fail('two-row subset attached'),error=>assert.equal((error as Error).message,'INCOMPLETE_SOURCE_GROUP'))
  assert.equal(JSON.stringify(await prisma.forceCurveReviewCase.findMany({where:{id:{in:exact80Reviews.map(r=>r.id)}},orderBy:{id:'asc'}})),exact80Before)
  assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:exact80Master.id}}),0)
  await prisma.forceCurveMapping.create({data:{masterSwitchId:exact80Master.id,catalogEntryId:exact80Raw.id,state:'MANUALLY_APPROVED',confidence:1,provenance:'prior explicit manual decision'}})
  assert.equal((await linkSourceReviewGroup({reviewIds:exact80Reviews.map(r=>r.id),masterSwitchId:exact80Master.id,catalogEntryId:exact80High.id,actorId:user.id},prisma)).linked,3)
  assert.equal(await prisma.forceCurveReviewCase.count({where:{id:{in:exact80Reviews.map(r=>r.id)},status:'RESOLVED',resolution:'MANUALLY_APPROVED'}}),3)
  assert.equal(await prisma.forceCurveMapping.count({where:{masterSwitchId:exact80Master.id,catalogEntryId:exact80High.id,state:'MANUALLY_APPROVED'}}),1)
  assert.equal((await getApprovedCurves(exact80Master.id)).length,2)
  const exact80Attached=JSON.stringify(await prisma.forceCurveReviewCase.findMany({where:{id:{in:exact80Reviews.map(r=>r.id)}},orderBy:{id:'asc'}}))
  assert.equal((await linkSourceReviewGroup({reviewIds:exact80Reviews.map(r=>r.id),masterSwitchId:exact80Master.id,catalogEntryId:exact80High.id,actorId:user.id},prisma)).replayed,true)
  await linkSourceReviewGroup({reviewIds:exact80Reviews.map(r=>r.id),masterSwitchId:exact80Master.id,catalogEntryId:exact80Raw.id,actorId:user.id},prisma).then(()=>assert.fail('changed-target replay attached'),error=>assert.equal((error as Error).message,'REVIEW_ALREADY_LINKED'))
  assert.equal(JSON.stringify(await prisma.forceCurveReviewCase.findMany({where:{id:{in:exact80Reviews.map(r=>r.id)}},orderBy:{id:'asc'}})),exact80Attached)
  const unrelatedConflict=await prisma.forceCurveReviewCase.create({data:{id:'r-80retros-r2-other-conflict',catalogEntryId:exact80High.id,kind:'TECHNOLOGY_CONFLICT',reason:'must not be group-linkable',payload:{measurementKey:exact80Key,candidateIds:[exact80High.id]}}})
  await linkSourceReviewGroup({reviewIds:[unrelatedConflict.id],masterSwitchId:exact80Master.id,catalogEntryId:exact80High.id,actorId:user.id},prisma).then(()=>assert.fail('unrelated conflict linked'),error=>assert.equal((error as Error).message,'REVIEW_CANDIDATE_REQUIRED'))
  const wrongSource80=await prisma.forceCurveCatalogEntry.create({data:{id:'c-80retros-r2-wrong-source',source:'wrong:source',repositoryPath:'80Retros QAExact 1989 Retro Blue/wrong.csv',displayName:'80Retros QAExact 1989 Retro Blue',contentHash:'wrong-source',exists:true}})
  const stale80=await prisma.forceCurveCatalogEntry.create({data:{id:'c-80retros-r2-stale',source:FORCE_CURVE_SOURCE,repositoryPath:'80Retros QAExact 1989 Retro Blue/stale.csv',displayName:'80Retros QAExact 1989 Retro Blue',contentHash:'stale',exists:false}})
  const invalidUnion=await prisma.forceCurveReviewCase.create({data:{id:'r-80retros-r2-invalid-union',catalogEntryId:exact80High.id,kind:'SOURCE_UNVERIFIED',reason:'union contains unavailable identities',payload:{measurementKey:exact80Key,candidateIds:[exact80High.id,wrongSource80.id,stale80.id,'c-80retros-r2-missing']}}})
  await linkSourceReviewGroup({reviewIds:[invalidUnion.id],masterSwitchId:exact80Master.id,catalogEntryId:exact80High.id,actorId:user.id},prisma).then(()=>assert.fail('invalid candidate union linked'),error=>assert.equal((error as Error).message,'REVIEW_CANDIDATE_REQUIRED'))
  assert.equal((await getApprovedCurves(unlinkedMaster.id)).length,1,'an exact attached source publishes one approved curve for card/API reads')
  const otherCatalog=await prisma.forceCurveCatalogEntry.create({data:{id:'group-link-other',source:FORCE_CURVE_SOURCE,repositoryPath:'KTT Other Source/KTT_Other_Source_HighResolutionRaw.csv',displayName:'KTT Other Source',contentHash:'other-source-sha',exists:true}})
  const mixed=await Promise.all([[unlinkedCatalog,'mixed-a'],[otherCatalog,'mixed-b']].map(([catalog,id])=>prisma.forceCurveReviewCase.create({data:{id:id as string,catalogEntryId:(catalog as typeof unlinkedCatalog).id,kind:'SOURCE_UNVERIFIED',reason:'mixed rollback',payload:{candidateIds:[(catalog as typeof unlinkedCatalog).id]}}})))
  await linkSourceReviewGroup({reviewIds:mixed.map(r=>r.id),masterSwitchId:unlinkedMaster.id,catalogEntryId:unlinkedCatalog.id,actorId:user.id},prisma).then(()=>assert.fail('mixed sources linked'),error=>assert.ok(['REVIEW_CANDIDATE_REQUIRED','AMBIGUOUS_REVIEW_IDENTITY','MIXED_SOURCE_GROUP'].includes((error as Error).message)))
  assert.ok((await prisma.forceCurveReviewCase.findMany({where:{id:{in:mixed.map(r=>r.id)}}})).every(r=>r.masterSwitchId===null))
  console.log(JSON.stringify({runs:await prisma.forceCurveSyncRun.count(),catalog:await prisma.forceCurveCatalogEntry.count(),reviews:await prisma.forceCurveReviewCase.count(),peachApprovedUrls:(await getApprovedCurves('cmqo21sm103vknu3vh0tjs75x')).map(x=>x.url)},null,2))
}
main().finally(()=>prisma.$disconnect())
