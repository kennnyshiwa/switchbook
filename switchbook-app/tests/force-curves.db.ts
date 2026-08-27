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
  const input = [{ path:'KTT Peach/TG.csv', sha:'a', manufacturer:'KTT', technology:'MECHANICAL' as const }]
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
  await syncForceCurveCatalog('peach-regression', [{path:'KTT Peach Blossom/TG.csv',sha:'pb',manufacturer:'KTT',technology:'MECHANICAL'}]); assert.deepEqual(await getApprovedCurves('cmqo21sm103vknu3vh0tjs75x'),[])
  const peachNoMatch = await prisma.forceCurveMapping.findUnique({where:{noMatchKey:'cmqo21sm103vknu3vh0tjs75x'}}); assert.equal(peachNoMatch?.state,'NO_MATCH')
  const feedbackCatalog = await prisma.forceCurveCatalogEntry.create({data:{source:FORCE_CURVE_SOURCE,repositoryPath:'KTT Feedback/TG.csv',displayName:'KTT Feedback',manufacturer:'KTT',technology:'MECHANICAL',exists:true}})
  await prisma.forceCurveMapping.create({data:{masterSwitchId:'m-feedback',catalogEntryId:feedbackCatalog.id,state:'AUTO_APPROVED',provenance:'fixture'}})
  const feedback = await recordForceCurveFeedback({userId:user.id,masterSwitchId:'m-feedback',catalogEntryId:feedbackCatalog.id,switchName:'Feedback',manufacturer:'KTT',incorrectMatch:'KTT Feedback/TG.csv',feedbackType:'no_match_found'})
  assert.ok(feedback.reviewCaseId); assert.equal((await prisma.forceCurveMapping.findFirstOrThrow({where:{masterSwitchId:'m-feedback',catalogEntryId:feedbackCatalog.id}})).state,'REVIEW_REQUIRED'); assert.equal((await prisma.forceCurveReviewCase.findUniqueOrThrow({where:{id:feedback.reviewCaseId!}})).kind,'FEEDBACK')
  const review = await prisma.forceCurveReviewCase.create({data:{masterSwitchId:'m-feedback',kind:'UNMATCHED',reason:'fixture',payload:{candidateIds:[]}}})
  await prisma.$transaction([prisma.forceCurveCatalogEntry.update({where:{id:feedbackCatalog.id},data:{manufacturer:'KTT',technology:'MECHANICAL',metadataVerifiedAt:new Date(),metadataVerifiedById:user.id}}),prisma.forceCurveReviewCase.update({where:{id:review.id},data:{catalogEntryId:feedbackCatalog.id,payload:{candidateIds:[feedbackCatalog.id],metadataVerification:{verifiedById:user.id}}}})])
  const verified = await prisma.forceCurveCatalogEntry.findUniqueOrThrow({where:{id:feedbackCatalog.id}}); assert.equal(verified.metadataVerifiedById,user.id); assert.ok(verified.metadataVerifiedAt)
  console.log(JSON.stringify({runs:await prisma.forceCurveSyncRun.count(),catalog:await prisma.forceCurveCatalogEntry.count(),reviews:await prisma.forceCurveReviewCase.count(),peachApprovedUrls:(await getApprovedCurves('cmqo21sm103vknu3vh0tjs75x')).map(x=>x.url)},null,2))
}
main().finally(()=>prisma.$disconnect())
