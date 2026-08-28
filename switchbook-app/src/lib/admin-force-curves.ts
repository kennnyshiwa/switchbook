import { ForceCurveMappingState, Prisma, PrismaClient, SwitchTechnology } from '@prisma/client'
import { FORCE_CURVE_SOURCE, selectAutomaticCandidates } from '@/lib/force-curves'

type Db = PrismaClient
type AdminSession = { user?: { id?: string; role?: string } } | null | undefined

export type ReviewBucket = 'ACTIONABLE'|'DUPLICATE'|'NO_MATCH'|'AMBIGUITY'|'CONFLICT'|'OTHER'
export type QueueReview = {
  id:string; kind:string; reason:string; masterSwitchId:string|null; catalogEntryId:string|null
  status:'OPEN'|'RESOLVED'; resolution?:ForceCurveMappingState|null
  payload: Prisma.JsonValue|null; masterSwitch:{id:string;name:string;manufacturer:string|null;technology:SwitchTechnology|null}|null
  candidates:{id:string;displayName:string;repositoryPath:string;manufacturer:string|null;technology:SwitchTechnology|null;contentHash:string|null;revision:string|null;exists:boolean}[]
}

const SOURCE_REVIEW_KINDS = ['SOURCE_UNVERIFIED', 'SOURCE_NONSTANDARD'] as const
const TECHNOLOGIES: SwitchTechnology[] = ['MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE']
const normalize = (value?: string | null) => (value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export function adminActor(session: AdminSession) {
  return session?.user?.role === 'ADMIN' && session.user.id ? session.user.id : null
}

export function isSameOriginMutation(request: { headers: { get(name: string): string | null }; nextUrl: { origin: string } }) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  try { return new URL(origin).origin === request.nextUrl.origin } catch { return false }
}

export function exactCatalogMasterIdentity(master: { name: string; manufacturer: string | null }, entry: { displayName: string; repositoryPath: string }) {
  if (!master.manufacturer) return false
  const manufacturer = normalize(master.manufacturer)
  const name = normalize(master.name)
  const expected = name === manufacturer || name.startsWith(`${manufacturer} `) ? name : `${manufacturer} ${name}`
  if (normalize(entry.displayName) !== expected) return false
  const folder = entry.repositoryPath.split('/').at(-2) || ''
  return normalize(folder) === normalize(entry.displayName)
}

function objectPayload(payload: Prisma.JsonValue | null) {
  return typeof payload === 'object' && payload && !Array.isArray(payload) ? payload as Record<string, Prisma.JsonValue> : {}
}

function candidateIds(payload: Prisma.JsonValue | null) {
  const value = objectPayload(payload).candidateIds
  return Array.isArray(value) && value.every(id => typeof id === 'string') ? value as string[] : []
}

export function reviewWorkflow(payload: Prisma.JsonValue | null) {
  const workflow = objectPayload(payload).queueWorkflow
  return typeof workflow === 'object' && workflow && !Array.isArray(workflow) ? workflow as Record<string, Prisma.JsonValue> : {}
}

/** Source-centric identity. A repository folder is one measured source switch; files below it are repeated evidence. */
export function sourceIdentity(review: QueueReview) {
  const payload=objectPayload(review.payload)
  const measurementKey=typeof payload.measurementKey==='string'?payload.measurementKey:null
  if(measurementKey) return `measurement:${normalize(measurementKey)}`
  const payloadPaths=Array.isArray(payload.paths)?payload.paths.filter((p):p is string=>typeof p==='string'):[]
  const paths = review.candidates.map(c => c.repositoryPath).sort()
  const path = review.candidates.find(c => c.id === review.catalogEntryId)?.repositoryPath || paths[0] || payloadPaths.sort()[0]
  if (path) return normalize(path.split('/')[0]) || path.toLowerCase()
  const sourceName=['sourceSwitch','sourceName','displayName','switchName'].map(k=>payload[k]).find(v=>typeof v==='string')
  if(typeof sourceName==='string') return `source:${normalize(sourceName)}`
  // A master ID is not source identity: unrelated evidence may point at the same candidate master.
  return `review:${review.id}`
}

export function classifyReviewGroup(reviews: QueueReview[]): {bucket:ReviewBucket;confidence:number;actionable:boolean} {
  const masters = new Set(reviews.flatMap(r => r.masterSwitchId ? [r.masterSwitchId] : []))
  const candidates = new Map(reviews.flatMap(r => r.candidates.filter(c => c.exists).map(c => [c.id,c])))
  if (masters.size > 1 || reviews.some(r => /conflict/i.test(`${r.kind} ${r.reason}`))) return {bucket:'CONFLICT',confidence:0,actionable:false}
  if (!candidates.size && reviews.every(r => /unmatched|no.?match/i.test(`${r.kind} ${r.reason}`))) return {bucket:'NO_MATCH',confidence:1,actionable:masters.size === 1}
  if (candidates.size > 1) return {bucket:'AMBIGUITY',confidence:0,actionable:false}
  const exact = candidates.size === 1 && masters.size === 1 && reviews.every(r => r.masterSwitch && exactCatalogMasterIdentity(r.masterSwitch,[...candidates.values()][0]))
  if (exact) return {bucket: reviews.length > 1 ? 'DUPLICATE':'ACTIONABLE',confidence:1,actionable:true}
  if (reviews.length > 1) return {bucket:'DUPLICATE',confidence:0,actionable:false}
  return {bucket:'OTHER',confidence:0,actionable:false}
}

export function buildReviewQueue(reviews: QueueReview[]) {
  const groups = new Map<string,QueueReview[]>()
  for (const review of reviews) { const key=sourceIdentity(review); groups.set(key,[...(groups.get(key)||[]),review]) }
  const items=[...groups].map(([sourceKey,evidence])=>{const open=evidence.filter(r=>r.status==='OPEN');return {sourceKey,evidence,...classifyReviewGroup(open.length?open:evidence),status:(open.length?'OPEN':'RESOLVED') as 'OPEN'|'RESOLVED',deferred:open.length>0&&open.every(r=>reviewWorkflow(r.payload).status==='DEFERRED')}})
    .sort((a,b)=>Number(b.actionable)-Number(a.actionable)||b.confidence-a.confidence||a.sourceKey.localeCompare(b.sourceKey))
  const counts = items.reduce((v,item)=>({...v,[item.bucket]:(v[item.bucket]||0)+1}),{} as Record<string,number>)
  return {items,counts,rawReviewCount:reviews.length,uniqueSourceCount:items.length,openSourceCount:items.filter(i=>i.status==='OPEN').length,resolvedSourceCount:items.filter(i=>i.status==='RESOLVED').length,remainingActionable:items.filter(i=>i.status==='OPEN'&&i.actionable&&!i.deferred).length,deferredCount:items.filter(i=>i.status==='OPEN'&&i.deferred).length}
}

export async function deferForceCurveReviews(input:{reviewIds:string[];reason?:string;actorId:string},db:Db) {
  const unique=[...new Set(input.reviewIds)]
  if (!unique.length || unique.length>100) throw new Error('INVALID_REVIEW_SELECTION')
  return db.$transaction(async tx => {
    const reviews=await tx.forceCurveReviewCase.findMany({where:{id:{in:unique},status:'OPEN'}})
    if(reviews.length!==unique.length) throw new Error('OPEN_REVIEW_REQUIRED')
    if(reviews.every(r=>reviewWorkflow(r.payload).status==='DEFERRED')) return {deferred:reviews.length,replayed:true}
    const now=new Date().toISOString()
    for(const review of reviews) await tx.forceCurveReviewCase.update({where:{id:review.id},data:{payload:{...objectPayload(review.payload),queueWorkflow:{status:'DEFERRED',actorId:input.actorId,at:now,reason:input.reason||null}} as Prisma.InputJsonValue}})
    return {deferred:reviews.length}
  })
}

export async function bulkApproveForceCurveReviews(input:{reviewIds:string[];catalogEntryId:string;actorId:string;reason?:string},db:Db) {
  const unique=[...new Set(input.reviewIds)]
  if (!unique.length || unique.length>100) throw new Error('INVALID_REVIEW_SELECTION')
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ForceCurveReviewCase" WHERE id IN (${Prisma.join(unique)}) FOR UPDATE`
    const rows=await tx.forceCurveReviewCase.findMany({where:{id:{in:unique}},include:{masterSwitch:true}})
    const candidate=await tx.forceCurveCatalogEntry.findUnique({where:{id:input.catalogEntryId}})
    if(rows.length!==unique.length || !candidate?.exists) throw new Error('OPEN_REVIEW_REQUIRED')
    if(rows.every(r=>r.status==='RESOLVED'&&r.resolution==='MANUALLY_APPROVED')) return {approved:rows.length,replayed:true,masterSwitchId:rows[0].masterSwitchId,catalogEntryId:candidate.id}
    if(rows.some(r=>r.status!=='OPEN')) throw new Error('OPEN_REVIEW_REQUIRED')
    const masterIds=new Set(rows.flatMap(r=>r.masterSwitchId?[r.masterSwitchId]:[]))
    if(masterIds.size!==1 || rows.some(r=>!r.masterSwitch || candidateIds(r.payload).length!==1 || !candidateIds(r.payload).includes(candidate.id) || !exactCatalogMasterIdentity(r.masterSwitch,candidate) || selectAutomaticCandidates(r.masterSwitch,[candidate]).length!==1)) throw new Error('UNSAFE_BULK_APPROVAL')
    if(rows[0].masterSwitch && normalize(rows[0].masterSwitch.name)==='peach blossom' && !candidate.metadataVerifiedAt) throw new Error('PEACH_BLOSSOM_AUTHORITATIVE_EVIDENCE_REQUIRED')
    // Bulk is restricted to repeated evidence for one source identity and one exact candidate.
    const queueRows=rows.map(r=>({...r,candidates:[candidate]})) as QueueReview[]
    if(new Set(queueRows.map(sourceIdentity)).size!==1 || !classifyReviewGroup(queueRows).actionable) throw new Error('UNSAFE_BULK_APPROVAL')
    const masterSwitchId=rows[0].masterSwitchId!
    const now=new Date(); const provenance=JSON.stringify({workflow:'admin-review-bulk',reviewIds:unique,actorId:input.actorId,decidedAt:now.toISOString(),source:candidate.source,repositoryPath:candidate.repositoryPath,masterSwitchId,catalogEntryId:candidate.id})
    await tx.forceCurveMapping.deleteMany({where:{noMatchKey:masterSwitchId}})
    await tx.forceCurveMapping.upsert({where:{masterSwitchId_catalogEntryId:{masterSwitchId,catalogEntryId:candidate.id}},create:{masterSwitchId,catalogEntryId:candidate.id,state:'MANUALLY_APPROVED',confidence:1,provenance,reason:input.reason,decidedById:input.actorId,decidedAt:now},update:{state:'MANUALLY_APPROVED',confidence:1,provenance,reason:input.reason,decidedById:input.actorId,decidedAt:now}})
    await tx.forceCurveReviewCase.updateMany({where:{id:{in:unique},status:'OPEN'},data:{status:'RESOLVED',resolution:'MANUALLY_APPROVED',resolvedById:input.actorId,resolvedAt:now}})
    return {approved:unique.length,masterSwitchId,catalogEntryId:candidate.id}
  })
}

export async function resolveNoMatchGroup(input:{reviewIds:string[];actorId:string;reason?:string},db:Db) {
  const unique=[...new Set(input.reviewIds)]; if(!unique.length||unique.length>100) throw new Error('INVALID_REVIEW_SELECTION')
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "ForceCurveReviewCase" WHERE id IN (${Prisma.join(unique)}) FOR UPDATE`
    const rows=await tx.forceCurveReviewCase.findMany({where:{id:{in:unique}},include:{masterSwitch:true}})
    if(rows.length!==unique.length) throw new Error('OPEN_REVIEW_REQUIRED')
    const masterIds=new Set(rows.flatMap(r=>r.masterSwitchId?[r.masterSwitchId]:[]))
    if(masterIds.size!==1) throw new Error('UNSAFE_GROUP_NO_MATCH')
    const masterSwitchId=rows[0].masterSwitchId!
    if(rows.every(r=>r.status==='RESOLVED'&&r.resolution==='NO_MATCH')) return {resolved:rows.length,replayed:true,masterSwitchId}
    if(rows.some(r=>r.status!=='OPEN')) throw new Error('OPEN_REVIEW_REQUIRED')
    const now=new Date();const provenance=JSON.stringify({workflow:'admin-review-group-no-match',reviewIds:unique,actorId:input.actorId,decidedAt:now.toISOString(),masterSwitchId})
    await tx.forceCurveMapping.updateMany({where:{masterSwitchId,state:{in:['AUTO_APPROVED','MANUALLY_APPROVED']}},data:{state:'STALE',reason:'Superseded by manual no-match decision'}})
    await tx.forceCurveMapping.upsert({where:{noMatchKey:masterSwitchId},create:{masterSwitchId,noMatchKey:masterSwitchId,state:'NO_MATCH',provenance,decidedById:input.actorId,decidedAt:now,reason:input.reason},update:{state:'NO_MATCH',provenance,decidedById:input.actorId,decidedAt:now,reason:input.reason}})
    await tx.forceCurveReviewCase.updateMany({where:{id:{in:unique},status:'OPEN'},data:{status:'RESOLVED',resolution:'NO_MATCH',resolvedById:input.actorId,resolvedAt:now}})
    return {resolved:rows.length,masterSwitchId}
  })
}

export async function linkSourceReview(input: { reviewId: string; masterSwitchId: string; catalogEntryId: string; actorId: string }, db: Db) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ForceCurveReviewCase" WHERE id = ${input.reviewId} FOR UPDATE`
    const review = await tx.forceCurveReviewCase.findUnique({ where: { id: input.reviewId } })
    if (!review || review.status !== 'OPEN' || !SOURCE_REVIEW_KINDS.includes(review.kind as typeof SOURCE_REVIEW_KINDS[number])) throw new Error('OPEN_SOURCE_REVIEW_REQUIRED')
    if (review.masterSwitchId && review.masterSwitchId !== input.masterSwitchId) throw new Error('REVIEW_ALREADY_LINKED')
    // Distinct review rows can race for the same master/catalog identity. The
    // selected master is their shared serialization point; recheck conflicts
    // only after this lock is held.
    await tx.$queryRaw`SELECT id FROM "MasterSwitch" WHERE id = ${input.masterSwitchId} FOR UPDATE`
    const [master, entries] = await Promise.all([
      tx.masterSwitch.findUnique({ where: { id: input.masterSwitchId }, select: { id: true, name: true, manufacturer: true, technology: true, status: true } }),
      tx.forceCurveCatalogEntry.findMany({ where: { id: { in: candidateIds(review.payload) }, source: FORCE_CURVE_SOURCE, exists: true } }),
    ])
    if (!master || master.status !== 'APPROVED' || !master.manufacturer || !master.technology) throw new Error('APPROVED_MASTER_REQUIRED')
    const selected = entries.find(entry => entry.id === input.catalogEntryId)
    if (!selected) throw new Error('REVIEW_CANDIDATE_REQUIRED')
    if (!exactCatalogMasterIdentity(master, selected)) throw new Error('INCOMPATIBLE_IDENTITY')
    if (entries.some(entry => !exactCatalogMasterIdentity(master, entry))) throw new Error('AMBIGUOUS_REVIEW_IDENTITY')

    const conflictingReview = await tx.forceCurveReviewCase.findFirst({ where: { id: { not: review.id }, status: 'OPEN', masterSwitchId: master.id, catalogEntryId: { in: entries.map(entry => entry.id) } } })
    if (conflictingReview) throw new Error('CONFLICTING_OPEN_REVIEW')
    const payload = objectPayload(review.payload)
    const now = new Date()
    return tx.forceCurveReviewCase.update({ where: { id: review.id }, data: {
      masterSwitchId: master.id,
      catalogEntryId: selected.id,
      payload: { ...payload, linkAudit: { actorId: input.actorId, linkedAt: now.toISOString(), source: selected.source, repositoryPath: selected.repositoryPath, revision: selected.revision, contentHash: selected.contentHash, masterSwitchId: master.id, catalogEntryId: selected.id } } as Prisma.InputJsonValue,
    } })
  })
}

export async function verifyReviewMetadata(input: { reviewId: string; catalogEntryId: string; manufacturer: string; technology: SwitchTechnology; actorId: string }, db: Db) {
  if (!input.manufacturer.trim() || !TECHNOLOGIES.includes(input.technology)) throw new Error('VERIFIED_METADATA_REQUIRED')
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ForceCurveReviewCase" WHERE id = ${input.reviewId} FOR UPDATE`
    const review = await tx.forceCurveReviewCase.findUnique({ where: { id: input.reviewId }, include: { masterSwitch: true } })
    const entry = await tx.forceCurveCatalogEntry.findUnique({ where: { id: input.catalogEntryId } })
    if (!review || review.status !== 'OPEN' || !review.masterSwitch || !entry?.exists) throw new Error('OPEN_LINKED_REVIEW_REQUIRED')
    if (!candidateIds(review.payload).includes(entry.id) || review.catalogEntryId !== entry.id) throw new Error('REVIEW_CANDIDATE_REQUIRED')
    if (normalize(input.manufacturer) !== normalize(review.masterSwitch.manufacturer) || input.technology !== review.masterSwitch.technology || !exactCatalogMasterIdentity(review.masterSwitch, entry)) throw new Error('INCOMPATIBLE_IDENTITY')
    const payload = objectPayload(review.payload)
    const now = new Date()
    await tx.forceCurveCatalogEntry.update({ where: { id: entry.id }, data: { manufacturer: input.manufacturer.trim(), technology: input.technology, metadataVerifiedAt: now, metadataVerifiedById: input.actorId } })
    return tx.forceCurveReviewCase.update({ where: { id: review.id }, data: { payload: { ...payload, metadataVerification: { catalogEntryId: entry.id, manufacturer: input.manufacturer.trim(), technology: input.technology, verifiedById: input.actorId, verifiedAt: now.toISOString() } } as Prisma.InputJsonValue } })
  })
}

export async function resolveForceCurveReview(input: { reviewId: string; resolution: Extract<ForceCurveMappingState, 'MANUALLY_APPROVED'|'REJECTED'|'NO_MATCH'>; catalogEntryId?: string; reason?: string; actorId: string }, db: Db) {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ForceCurveReviewCase" WHERE id = ${input.reviewId} FOR UPDATE`
    const review = await tx.forceCurveReviewCase.findUnique({ where: { id: input.reviewId }, include: { masterSwitch: true } })
    if (!review || review.status !== 'OPEN') throw new Error('OPEN_REVIEW_REQUIRED')
    if (!review.masterSwitchId || !review.masterSwitch) throw new Error('LINKED_MASTER_REQUIRED')
    const targetId = input.catalogEntryId || review.catalogEntryId || undefined
    const candidate = targetId ? await tx.forceCurveCatalogEntry.findUnique({ where: { id: targetId } }) : null
    if (input.resolution !== 'NO_MATCH') {
      if (!candidate || !candidate.exists || !candidateIds(review.payload).includes(candidate.id)) throw new Error('REVIEW_CANDIDATE_REQUIRED')
      if (!exactCatalogMasterIdentity(review.masterSwitch, candidate)) throw new Error('INCOMPATIBLE_IDENTITY')
      if (input.resolution === 'MANUALLY_APPROVED' && !selectAutomaticCandidates(review.masterSwitch, [candidate]).length) throw new Error('INCOMPATIBLE_IDENTITY')
      if (input.resolution === 'MANUALLY_APPROVED' && normalize(review.masterSwitch.name) === 'peach blossom' && !candidate.metadataVerifiedAt) throw new Error('PEACH_BLOSSOM_AUTHORITATIVE_EVIDENCE_REQUIRED')
    }
    const now = new Date()
    const provenance = JSON.stringify({ workflow: 'admin-review', reviewId: review.id, actorId: input.actorId, decidedAt: now.toISOString(), source: candidate?.source || review.catalogEntryId && FORCE_CURVE_SOURCE, repositoryPath: candidate?.repositoryPath || null, masterSwitchId: review.masterSwitchId, catalogEntryId: candidate?.id || review.catalogEntryId })
    if (input.resolution === 'NO_MATCH') {
      await tx.forceCurveMapping.updateMany({ where: { masterSwitchId: review.masterSwitchId, state: { in: ['AUTO_APPROVED', 'MANUALLY_APPROVED'] } }, data: { state: 'STALE', reason: 'Superseded by manual no-match decision' } })
      await tx.forceCurveMapping.upsert({ where: { noMatchKey: review.masterSwitchId }, create: { masterSwitchId: review.masterSwitchId, noMatchKey: review.masterSwitchId, state: 'NO_MATCH', provenance, decidedById: input.actorId, decidedAt: now, reason: input.reason }, update: { state: 'NO_MATCH', provenance, decidedById: input.actorId, decidedAt: now, reason: input.reason } })
    } else {
      await tx.forceCurveMapping.deleteMany({ where: { noMatchKey: review.masterSwitchId } })
      await tx.forceCurveMapping.upsert({ where: { masterSwitchId_catalogEntryId: { masterSwitchId: review.masterSwitchId, catalogEntryId: candidate!.id } }, create: { masterSwitchId: review.masterSwitchId, catalogEntryId: candidate!.id, state: input.resolution, provenance, decidedById: input.actorId, decidedAt: now, reason: input.reason }, update: { state: input.resolution, provenance, decidedById: input.actorId, decidedAt: now, reason: input.reason } })
    }
    return tx.forceCurveReviewCase.update({ where: { id: review.id }, data: { status: 'RESOLVED', resolution: input.resolution, resolvedById: input.actorId, resolvedAt: now } })
  })
}
