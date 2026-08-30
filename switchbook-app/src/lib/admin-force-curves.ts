import { ForceCurveMappingState, Prisma, PrismaClient, SwitchTechnology } from '@prisma/client'
import { FORCE_CURVE_SOURCE } from '@/lib/force-curves'

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
const GROUP_LINKABLE_REVIEW_KINDS = [...SOURCE_REVIEW_KINDS, 'MANUFACTURER_CONFLICT'] as const
const TECHNOLOGIES: SwitchTechnology[] = ['MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE']
const normalize = (value?: string | null) => (value || '').toLowerCase().replace(/([a-z])([0-9])/g, '$1 $2').replace(/([0-9])([a-z])/g, '$1 $2').replace(/[^a-z0-9]+/g, ' ').trim()

export function adminActor(session: AdminSession) {
  return session?.user?.role === 'ADMIN' && session.user.id ? session.user.id : null
}

export function isSameOriginMutation(request: { headers: { get(name: string): string | null }; nextUrl: { origin: string } }) {
  const origin = request.headers.get('origin')
  if (!origin) return false
  const forwardedHost = request.headers.get('x-forwarded-host') || request.headers.get('host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  if (!forwardedHost || !forwardedProto || forwardedHost.includes(',') || !['http', 'https'].includes(forwardedProto)) return false
  try {
    const canonicalOrigin = new URL(process.env.NEXTAUTH_URL || request.nextUrl.origin).origin
    const originUrl = new URL(origin)
    const proxyUrl = new URL(`${forwardedProto}://${forwardedHost}`)
    if (originUrl.username || originUrl.password || originUrl.pathname !== '/' || originUrl.search || originUrl.hash) return false
    if (proxyUrl.username || proxyUrl.password || proxyUrl.pathname !== '/' || proxyUrl.search || proxyUrl.hash) return false
    return originUrl.origin === canonicalOrigin && proxyUrl.origin === canonicalOrigin
  } catch { return false }
}

export type CatalogMasterCompatibility = { compatible: boolean; reason: string }
export type KnownManufacturer = { name: string; aliases?: string[] }
type CompatibleMaster = { id: string; name: string; manufacturer: string | null; technology?: SwitchTechnology | null }
type CompatibleEntry = { displayName: string; repositoryPath: string; technology?: SwitchTechnology | null }
const COMPATIBILITY_CANDIDATE_LIMIT = 200

function identityTokens(value: string) { return normalize(value).split(' ').filter(Boolean) }

// ThereminGoat publishes the KTT GAME1989 color family as "80Retros Retro
// <variant>" while approved MasterSwitch records use "80Retros GAME1989
// <variant>". Canonicalize the family shape, but retain the complete variant
// suffix: Red cannot match Orange, V2, or any other sibling. The compatibility
// gate below additionally requires the exact canonical name and KTT maker.
const RETRO_FAMILY_SOURCE_PREFIX = ['80', 'retros', 'retro']
const RETRO_FAMILY_MASTER_PREFIX = ['80', 'retros', 'game', '1989']

function retroFamilyVariant(value: string, prefix: string[]) {
  const tokens = identityTokens(value)
  return prefix.every((token, index) => tokens[index] === token) && tokens.length > prefix.length ? tokens.slice(prefix.length) : null
}

function retroFamilyCanonicalTokens(value: string) {
  const sourceVariant = retroFamilyVariant(value, RETRO_FAMILY_SOURCE_PREFIX)
  if (sourceVariant) return [...RETRO_FAMILY_MASTER_PREFIX, ...sourceVariant]
  const masterVariant = retroFamilyVariant(value, RETRO_FAMILY_MASTER_PREFIX)
  return masterVariant ? [...RETRO_FAMILY_MASTER_PREFIX, ...masterVariant] : null
}

function canonicalProductIdentityTokens(value: string) {
  return retroFamilyCanonicalTokens(value) || identityTokens(value)
}

export function catalogMasterSearchTerms(query: string, entry: CompatibleEntry) {
  const terms = [query.trim()].filter(Boolean)
  const sourceVariant = retroFamilyVariant(entry.displayName, RETRO_FAMILY_SOURCE_PREFIX)
  const queryVariant = retroFamilyVariant(query, RETRO_FAMILY_SOURCE_PREFIX)
    || retroFamilyVariant(`80Retros ${query}`, RETRO_FAMILY_SOURCE_PREFIX)
  if (sourceVariant && queryVariant?.join(' ') === sourceVariant.join(' ')) terms.push(`80Retros GAME1989 ${sourceVariant.map(token => token[0].toUpperCase()+token.slice(1)).join(' ')}`)
  return [...new Set(terms)]
}

function orderedTokenMatch(required: string[], available: string[]) {
  let cursor = 0
  for (const token of available) if (token === required[cursor]) cursor++
  return { matched: required.slice(0, cursor), missing: required.slice(cursor), complete: cursor === required.length }
}

function manufacturerPrefixes(known: KnownManufacturer[]) {
  return known.flatMap(m => [m.name, ...(m.aliases || [])].map(alias => ({ canonical: normalize(m.name), tokens: identityTokens(alias) }))).filter(p => p.tokens.length).sort((a,b) => b.tokens.length-a.tokens.length)
}

function canonicalManufacturer(value: string | null, known: KnownManufacturer[]) {
  const normalized=normalize(value)
  return manufacturerPrefixes(known).find(prefix=>normalize(prefix.tokens.join(' '))===normalized)?.canonical || normalized
}

function catalogProductTokens(entry: CompatibleEntry, known: KnownManufacturer[]) {
  const tokens=canonicalProductIdentityTokens(entry.displayName)
  const prefix=manufacturerPrefixes(known).find(candidate=>candidate.tokens.every((token,index)=>tokens[index]===token))
  return {tokens:prefix?tokens.slice(prefix.tokens.length):tokens,prefix}
}

export function catalogMasterCompatibility(master: { name: string; manufacturer: string | null; technology?: SwitchTechnology | null }, entry: { displayName: string; repositoryPath: string; technology?: SwitchTechnology | null }, knownManufacturers: KnownManufacturer[] = []): CatalogMasterCompatibility {
  const folder = entry.repositoryPath.split('/').at(-2) || ''
  if (normalize(folder) !== normalize(entry.displayName)) return { compatible: false, reason: 'Catalog folder and display identity do not match.' }
  if (entry.technology && master.technology && entry.technology !== master.technology) return { compatible: false, reason: `Technology mismatch: catalog is ${entry.technology}, MasterSwitch is ${master.technology}.` }
  const retroVariant = retroFamilyVariant(entry.displayName, RETRO_FAMILY_SOURCE_PREFIX)
  if (retroVariant) {
    const expectedMasterIdentity = [...RETRO_FAMILY_MASTER_PREFIX, ...retroVariant].join(' ')
    if (normalize(master.name) !== expectedMasterIdentity || normalize(master.manufacturer) !== 'ktt') return { compatible: false, reason: `Product alias mismatch: 80Retros Retro ${retroVariant.join(' ')} requires the exact KTT 80Retros GAME1989 ${retroVariant.join(' ')} MasterSwitch.` }
  }
  const masterIdentity = canonicalProductIdentityTokens(master.name)
  let catalogIdentity = canonicalProductIdentityTokens(entry.displayName)
  const recognizedPrefix = manufacturerPrefixes(knownManufacturers).find(prefix => prefix.tokens.every((token,index) => catalogIdentity[index] === token))
  if (recognizedPrefix) {
    if (recognizedPrefix.canonical !== canonicalManufacturer(master.manufacturer,knownManufacturers)) return { compatible: false, reason: `Manufacturer mismatch: catalog prefix identifies ${recognizedPrefix.canonical}; selected MasterSwitch manufacturer is ${normalize(master.manufacturer) || 'missing'}.` }
    catalogIdentity = catalogIdentity.slice(recognizedPrefix.tokens.length)
  }
  if (!masterIdentity.length || !catalogIdentity.length) return { compatible: false, reason: 'Catalog or MasterSwitch product identity is empty.' }
  const result = orderedTokenMatch(catalogIdentity, masterIdentity)
  if (!result.complete) return { compatible: false, reason: `Product identity mismatch: matched [${result.matched.join(', ')}]; missing [${result.missing.join(', ')}] in MasterSwitch name.` }
  return { compatible: true, reason: `Verified ordered product identity: [${catalogIdentity.join(', ')}]; extra MasterSwitch qualifiers are allowed.` }
}

export function uniqueCatalogMasterCompatibility(master: CompatibleMaster, entry: CompatibleEntry, knownManufacturers: KnownManufacturer[], approvedMasters: CompatibleMaster[]): CatalogMasterCompatibility {
  const result = catalogMasterCompatibility(master, entry, knownManufacturers)
  if (!result.compatible) return result
  const compatibleIds = approvedMasters.filter(candidate => catalogMasterCompatibility(candidate, entry, knownManufacturers).compatible).map(candidate => candidate.id)
  if (compatibleIds.length !== 1 || compatibleIds[0] !== master.id) return { compatible: false, reason: `Ambiguous product identity: ${compatibleIds.length} approved MasterSwitch records match; refine canonical identity before attaching.` }
  return result
}

export type CatalogMasterResolution = { uniqueMasterId: string | null; knownManufacturers: KnownManufacturer[]; compatibleMasters: CompatibleMaster[]; reason: string }

/** Bounded authoritative resolver used by UI annotation and every mutation. */
export async function resolveUniqueCatalogMaster(db: any, entry: CompatibleEntry): Promise<CatalogMasterResolution> {
  const knownManufacturers:KnownManufacturer[]=await db.manufacturer.findMany({where:{verified:true},select:{name:true,aliases:true}})
  const required=catalogProductTokens(entry,knownManufacturers).tokens
  // Family aliases share broad tokens (80Retros/GAME1989), so use the
  // preserved variant as the bounded lookup anchor. Exact identity and maker
  // checks still run after candidate retrieval.
  const retroVariant=retroFamilyVariant(entry.displayName,RETRO_FAMILY_SOURCE_PREFIX)
  const anchor=[...(retroVariant||required)].sort((a,b)=>b.length-a.length||a.localeCompare(b))[0]
  if(!anchor) return {uniqueMasterId:null,knownManufacturers,compatibleMasters:[],reason:'Catalog product identity is empty.'}
  const candidates:CompatibleMaster[]=await db.masterSwitch.findMany({where:{status:'APPROVED',name:{contains:anchor,mode:'insensitive'}},select:{id:true,name:true,manufacturer:true,technology:true},orderBy:{id:'asc'},take:COMPATIBILITY_CANDIDATE_LIMIT+1})
  if(candidates.length>COMPATIBILITY_CANDIDATE_LIMIT) return {uniqueMasterId:null,knownManufacturers,compatibleMasters:[],reason:`Product identity is too broad: more than ${COMPATIBILITY_CANDIDATE_LIMIT} approved MasterSwitch records contain anchor [${anchor}]. Refine canonical identity.`}
  const compatibleMasters=candidates.filter(master=>catalogMasterCompatibility(master,entry,knownManufacturers).compatible)
  const uniqueMasterId=compatibleMasters.length===1?compatibleMasters[0].id:null
  return {uniqueMasterId,knownManufacturers,compatibleMasters,reason:uniqueMasterId?'Unique approved MasterSwitch identity verified.':`Ambiguous product identity: ${compatibleMasters.length} approved MasterSwitch records match; refine canonical identity before attaching.`}
}

export function resolvedCatalogMasterCompatibility(master:CompatibleMaster,entry:CompatibleEntry,resolution:CatalogMasterResolution):CatalogMasterCompatibility {
  const base=catalogMasterCompatibility(master,entry,resolution.knownManufacturers)
  if(!base.compatible)return base
  return resolution.uniqueMasterId===master.id?base:{compatible:false,reason:resolution.reason}
}

async function resolveCatalogEntries(db:any,entries:(CompatibleEntry&{id:string})[]){
  const cache=new Map<string,Promise<CatalogMasterResolution>>()
  return Promise.all(entries.map(entry=>{const key=`${normalize(entry.displayName)}|${normalize(entry.repositoryPath.split('/').at(-2))}|${entry.technology||''}`;if(!cache.has(key))cache.set(key,resolveUniqueCatalogMaster(db,entry));return cache.get(key)!}))
}

export function exactCatalogMasterIdentity(master: { name: string; manufacturer: string | null }, entry: { displayName: string; repositoryPath: string }) {
  // Conservative synchronous projection used only to order/label the queue.
  // The authoritative async resolver gates every write.
  return catalogMasterCompatibility(master, entry, master.manufacturer?[{name:master.manufacturer}]:[]).compatible
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

function isAttachedReview(review: { payload: Prisma.JsonValue | null }) {
  return reviewWorkflow(review.payload).status === 'ATTACHED'
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
  const items=[...groups].map(([sourceKey,evidence])=>{const open=evidence.filter(r=>r.status==='OPEN'&&!isAttachedReview(r)),primary=open[0]||evidence[0];return {sourceKey,evidence,primaryReviewId:primary.id,...classifyReviewGroup(open.length?open:evidence),status:(open.length?'OPEN':'RESOLVED') as 'OPEN'|'RESOLVED',attached:!open.length&&evidence.some(isAttachedReview),deferred:open.length>0&&open.every(r=>reviewWorkflow(r.payload).status==='DEFERRED')}})
    .sort((a,b)=>Number(b.actionable)-Number(a.actionable)||b.confidence-a.confidence||a.sourceKey.localeCompare(b.sourceKey))
  const counts = items.reduce((v,item)=>({...v,[item.bucket]:(v[item.bucket]||0)+1}),{} as Record<string,number>)
  return {items,counts,rawReviewCount:reviews.length,uniqueSourceCount:items.length,openSourceCount:items.filter(i=>i.status==='OPEN').length,resolvedSourceCount:items.filter(i=>i.status==='RESOLVED').length,remainingActionable:items.filter(i=>i.status==='OPEN'&&i.actionable&&!i.deferred).length,deferredCount:items.filter(i=>i.status==='OPEN'&&i.deferred).length}
}

export async function deferForceCurveReviews(input:{reviewIds:string[];reason?:string;actorId:string},db:Db) {
  const unique=[...new Set(input.reviewIds)]
  if (!unique.length || unique.length>100) throw new Error('INVALID_REVIEW_SELECTION')
  return db.$transaction(async tx => {
    const reviews=await tx.forceCurveReviewCase.findMany({where:{id:{in:unique}}})
    if(reviews.length!==unique.length) throw new Error('OPEN_REVIEW_REQUIRED')
    if(reviews.some(isAttachedReview)) throw new Error('ATTACHED_REVIEW_IMMUTABLE')
    if(reviews.some(review=>review.status!=='OPEN')) throw new Error('OPEN_REVIEW_REQUIRED')
    if(reviews.every(r=>reviewWorkflow(r.payload).status==='DEFERRED')) return {deferred:reviews.length,replayed:true}
    const now=new Date().toISOString()
    for(const review of reviews) await tx.forceCurveReviewCase.update({where:{id:review.id},data:{payload:{...objectPayload(review.payload),queueWorkflow:{status:'DEFERRED',actorId:input.actorId,at:now,reason:input.reason||null}} as Prisma.InputJsonValue}})
    return {deferred:reviews.length}
  })
}

export type ForceCurveCompatibilityOverride = { acknowledged: true; reason: string }

export async function linkSourceReviewGroup(input:{reviewIds:string[];masterSwitchId:string;catalogEntryId:string;actorId:string;compatibilityOverride?:ForceCurveCompatibilityOverride},db:Db) {
  const unique=[...new Set(input.reviewIds)];if(!unique.length||unique.length>100) throw new Error('INVALID_REVIEW_SELECTION')
  return db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM "ForceCurveReviewCase" WHERE id IN (${Prisma.join(unique)}) FOR UPDATE`
    await tx.$queryRaw`SELECT id FROM "MasterSwitch" WHERE id = ${input.masterSwitchId} FOR UPDATE`
    const [rows,master,candidate]=await Promise.all([
      tx.forceCurveReviewCase.findMany({where:{id:{in:unique}},include:{masterSwitch:true}}),
      tx.masterSwitch.findUnique({where:{id:input.masterSwitchId}}),
      tx.forceCurveCatalogEntry.findUnique({where:{id:input.catalogEntryId}}),
    ])
    if(rows.length!==unique.length) throw new Error('OPEN_SOURCE_REVIEW_REQUIRED')
    const replay=rows.every(row=>row.status==='RESOLVED'&&row.resolution==='MANUALLY_APPROVED'&&isAttachedReview(row)&&row.masterSwitchId===input.masterSwitchId&&row.catalogEntryId===input.catalogEntryId)
    const legacyAttached=rows.every(row=>row.status==='OPEN'&&isAttachedReview(row)&&row.masterSwitchId===input.masterSwitchId&&row.catalogEntryId===input.catalogEntryId)
    if(rows.some(isAttachedReview)&&!replay&&!legacyAttached) throw new Error('REVIEW_ALREADY_LINKED')
    if(!replay&&!legacyAttached&&rows.some(r=>r.status!=='OPEN')) throw new Error('OPEN_SOURCE_REVIEW_REQUIRED')
    if(!master||master.status!=='APPROVED'||!master.manufacturer||!master.technology) throw new Error('APPROVED_MASTER_REQUIRED')
    // A completed same-target retry is a read-only validation. Return before
    // compatibility resolution, timestamps, upserts, or audit construction so
    // even a changed retry reason cannot rewrite the original decision record.
    if(replay) {
      const mapping=await tx.forceCurveMapping.findUnique({where:{masterSwitchId_catalogEntryId:{masterSwitchId:master.id,catalogEntryId:input.catalogEntryId}}})
      if(mapping?.state!=='MANUALLY_APPROVED'||rows.some(row=>!objectPayload(row.payload).linkAudit)) throw new Error('ATTACH_REPLAY_MISMATCH')
      return {linked:rows.length,masterSwitchId:master.id,catalogEntryId:input.catalogEntryId,replayed:true}
    }
    const selectedResolution=candidate?await resolveUniqueCatalogMaster(tx,candidate):null
    const selectedCompatibility=candidate&&selectedResolution?resolvedCatalogMasterCompatibility(master,candidate,selectedResolution):null
    const overrideReason=input.compatibilityOverride?.reason.trim()||''
    const overrideRequested=input.compatibilityOverride?.acknowledged===true
    if(overrideRequested&&overrideReason.length<3) throw new Error('OVERRIDE_REASON_REQUIRED')
    if(!candidate?.exists||candidate.source!==FORCE_CURVE_SOURCE||!selectedResolution) throw new Error('INCOMPATIBLE_IDENTITY')
    if(!selectedCompatibility?.compatible&&!overrideRequested) throw new Error('INCOMPATIBLE_IDENTITY')
    // MANUFACTURER_CONFLICT is linkable only as part of a proven homogeneous
    // source group. Single-row linking intentionally remains restricted to the
    // ordinary source-review kinds below.
    if(rows.some(r=>!GROUP_LINKABLE_REVIEW_KINDS.includes(r.kind as typeof GROUP_LINKABLE_REVIEW_KINDS[number])||!candidateIds(r.payload).length)) throw new Error('REVIEW_CANDIDATE_REQUIRED')
    const allCandidateIds=[...new Set(rows.flatMap(r=>candidateIds(r.payload)))]
    if(!allCandidateIds.includes(candidate.id)) throw new Error('REVIEW_CANDIDATE_REQUIRED')
    const allCandidates=await tx.forceCurveCatalogEntry.findMany({where:{id:{in:allCandidateIds},source:FORCE_CURVE_SOURCE,exists:true}})
    if(allCandidates.length!==allCandidateIds.length) throw new Error('REVIEW_CANDIDATE_REQUIRED')
    const allResolutions=await resolveCatalogEntries(tx,allCandidates)
    const allCompatibilities=allCandidates.map((entry,index)=>resolvedCatalogMasterCompatibility(master,entry,allResolutions[index]))
    if(allCompatibilities.some(result=>!result.compatible)&&!overrideRequested) throw new Error('AMBIGUOUS_REVIEW_IDENTITY')
    const catalogGroups=new Set(allCandidates.map(entry=>`${normalize(entry.displayName)}|${normalize(entry.repositoryPath.split('/').at(-2))}`))
    if(catalogGroups.size!==1) throw new Error('MIXED_SOURCE_GROUP')
    // Use the exact same loaded catalog evidence as buildReviewQueue. This is
    // essential for legacy rows whose payload contains only candidateIds.
    const shaped=rows.map(r=>({...r,candidates:allCandidates.filter(entry=>candidateIds(r.payload).includes(entry.id))})) as QueueReview[]
    if(shaped.some(r=>!r.candidates.length)||new Set(shaped.map(sourceIdentity)).size!==1) throw new Error('MIXED_SOURCE_GROUP')
    // Selection must cover the complete active source group. Otherwise a
    // subset can disappear while sibling evidence remains actionable. Load the
    // bounded review table and enrich only this catalog identity for legacy
    // candidateIds-only rows; modern rows group directly by measurementKey.
    const sourceKey=sourceIdentity(shaped[0])
    const siblingCatalog=await tx.forceCurveCatalogEntry.findMany({where:{source:FORCE_CURVE_SOURCE,exists:true,displayName:candidate.displayName}})
    const siblingCatalogMap=new Map(siblingCatalog.map(entry=>[entry.id,entry]))
    const openSourceRows=await tx.forceCurveReviewCase.findMany({where:{status:'OPEN',kind:{in:[...GROUP_LINKABLE_REVIEW_KINDS]}},include:{masterSwitch:true}})
    const completeIds=openSourceRows.filter(row=>!isAttachedReview(row)&&sourceIdentity({...row,candidates:candidateIds(row.payload).flatMap(id=>siblingCatalogMap.get(id)||[])} as QueueReview)===sourceKey).map(row=>row.id).sort()
    const legacySourceRows=openSourceRows.filter(row=>sourceIdentity({...row,candidates:candidateIds(row.payload).flatMap(id=>siblingCatalogMap.get(id)||[])} as QueueReview)===sourceKey)
    if(!replay&&!legacyAttached&&(completeIds.length!==unique.length||completeIds.some((id,index)=>id!==[...unique].sort()[index]))) throw new Error('INCOMPLETE_SOURCE_GROUP')
    if(legacyAttached&&(legacySourceRows.length!==unique.length||legacySourceRows.some(row=>!isAttachedReview(row)||row.masterSwitchId!==master.id||row.catalogEntryId!==candidate.id)||legacySourceRows.map(row=>row.id).sort().some((id,index)=>id!==[...unique].sort()[index]))) throw new Error('INCOMPLETE_SOURCE_GROUP')
    const conflicts=await tx.forceCurveReviewCase.findMany({where:{id:{notIn:unique},status:'OPEN',masterSwitchId:master.id,catalogEntryId:{in:allCandidateIds}},select:{payload:true}})
    if(conflicts.some(row=>!isAttachedReview(row))) throw new Error('CONFLICTING_OPEN_REVIEW')
    const conflictingMappings=await tx.forceCurveMapping.findMany({where:{masterSwitchId:master.id,state:{in:['AUTO_APPROVED','MANUALLY_APPROVED']},catalogEntryId:{not:candidate.id}}})
    if(conflictingMappings.some(mapping=>mapping.state==='MANUALLY_APPROVED')) throw new Error('CONFLICTING_APPROVED_MAPPING')
    const now=new Date()
    const compatibilityOverride=overrideRequested?{acknowledged:true,reason:overrideReason,actorId:input.actorId,compatibilityReason:selectedCompatibility?.reason||'Identity compatibility could not be verified',evidence:allCandidates.map((entry,index)=>({catalogEntryId:entry.id,repositoryPath:entry.repositoryPath,revision:entry.revision,contentHash:entry.contentHash,compatible:allCompatibilities[index].compatible,compatibilityReason:allCompatibilities[index].reason}))}:undefined
    const provenance=JSON.stringify({workflow:'admin-source-attach',reviewIds:unique,actorId:input.actorId,decidedAt:now.toISOString(),source:candidate.source,repositoryPath:candidate.repositoryPath,revision:candidate.revision,contentHash:candidate.contentHash,masterSwitchId:master.id,catalogEntryId:candidate.id,compatibilityOverride})
    await tx.forceCurveMapping.deleteMany({where:{noMatchKey:master.id}})
    await tx.forceCurveMapping.updateMany({where:{id:{in:conflictingMappings.filter(mapping=>mapping.state==='AUTO_APPROVED').map(mapping=>mapping.id)}},data:{state:'STALE',reason:'Superseded by exact manual source attachment'}})
    const mappingReason=overrideRequested?'Compatibility warning overridden by admin':'Exact source group attached by admin'
    await tx.forceCurveMapping.upsert({where:{masterSwitchId_catalogEntryId:{masterSwitchId:master.id,catalogEntryId:candidate.id}},create:{masterSwitchId:master.id,catalogEntryId:candidate.id,state:'MANUALLY_APPROVED',confidence:overrideRequested?0:1,provenance,reason:mappingReason,decidedById:input.actorId,decidedAt:now},update:{state:'MANUALLY_APPROVED',confidence:overrideRequested?0:1,provenance,reason:mappingReason,decidedById:input.actorId,decidedAt:now}})
    for(const row of rows) { const payload=objectPayload(row.payload); const linkAudit=legacyAttached&&payload.linkAudit?payload.linkAudit:{actorId:input.actorId,linkedAt:now.toISOString(),source:candidate.source,repositoryPath:candidate.repositoryPath,revision:candidate.revision,contentHash:candidate.contentHash,masterSwitchId:master.id,catalogEntryId:candidate.id,compatibilityOverride}; await tx.forceCurveReviewCase.update({where:{id:row.id},data:{masterSwitchId:master.id,catalogEntryId:candidate.id,status:'RESOLVED',resolution:'MANUALLY_APPROVED',resolvedById:input.actorId,resolvedAt:now,payload:{...payload,queueWorkflow:legacyAttached?payload.queueWorkflow:{status:'ATTACHED',actorId:input.actorId,at:now.toISOString()},linkAudit} as Prisma.InputJsonValue}}) }
    return {linked:rows.length,masterSwitchId:master.id,catalogEntryId:candidate.id}
  })
}

export async function bulkApproveForceCurveReviews(input:{reviewIds:string[];catalogEntryId:string;actorId:string;reason?:string},db:Db) {
  const unique=[...new Set(input.reviewIds)]
  if (!unique.length || unique.length>100) throw new Error('INVALID_REVIEW_SELECTION')
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "ForceCurveReviewCase" WHERE id IN (${Prisma.join(unique)}) FOR UPDATE`
    const rows=await tx.forceCurveReviewCase.findMany({where:{id:{in:unique}},include:{masterSwitch:true}})
    const candidate=await tx.forceCurveCatalogEntry.findUnique({where:{id:input.catalogEntryId}})
    if(rows.length!==unique.length) throw new Error('OPEN_REVIEW_REQUIRED')
    if(rows.some(isAttachedReview)) throw new Error('ATTACHED_REVIEW_IMMUTABLE')
    if(!candidate?.exists || candidate.source!==FORCE_CURVE_SOURCE) throw new Error('OPEN_REVIEW_REQUIRED')
    const resolution=candidate?await resolveUniqueCatalogMaster(tx,candidate):null
    const masterIds=new Set(rows.flatMap(r=>r.masterSwitchId?[r.masterSwitchId]:[]))
    if(masterIds.size!==1 || !resolution || rows.some(r=>!SOURCE_REVIEW_KINDS.includes(r.kind as typeof SOURCE_REVIEW_KINDS[number]) || !r.masterSwitch || candidateIds(r.payload).length!==1 || !candidateIds(r.payload).includes(candidate.id) || !resolvedCatalogMasterCompatibility(r.masterSwitch,candidate,resolution).compatible)) throw new Error('UNSAFE_BULK_APPROVAL')
    if(rows.every(r=>r.status==='RESOLVED'&&r.resolution==='MANUALLY_APPROVED')) {
      const masterSwitchId=rows[0].masterSwitchId!
      const mapping=await tx.forceCurveMapping.findUnique({where:{masterSwitchId_catalogEntryId:{masterSwitchId,catalogEntryId:candidate.id}}})
      if(mapping?.state!=='MANUALLY_APPROVED') throw new Error('BULK_REPLAY_MISMATCH')
      return {approved:rows.length,replayed:true,masterSwitchId,catalogEntryId:candidate.id}
    }
    if(rows.some(r=>r.status!=='OPEN')) throw new Error('OPEN_REVIEW_REQUIRED')
    if(rows[0].masterSwitch && normalize(rows[0].masterSwitch.name)==='peach blossom' && !candidate.metadataVerifiedAt) throw new Error('PEACH_BLOSSOM_AUTHORITATIVE_EVIDENCE_REQUIRED')
    // The authoritative resolver above has already established the sole approved
    // master. Bulk adds only explicit source/candidate homogeneity invariants; it
    // must never fall back to the weaker synchronous queue classifier.
    const queueRows=rows.map(r=>({...r,candidates:[candidate]})) as QueueReview[]
    if(new Set(queueRows.map(sourceIdentity)).size!==1 || new Set(rows.map(r=>r.catalogEntryId)).size!==1 || rows[0].catalogEntryId!==candidate.id) throw new Error('UNSAFE_BULK_APPROVAL')
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
    if(rows.some(isAttachedReview)) throw new Error('ATTACHED_REVIEW_IMMUTABLE')
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
    if (!review) throw new Error('OPEN_SOURCE_REVIEW_REQUIRED')
    if (isAttachedReview(review)) throw new Error('ATTACHED_REVIEW_IMMUTABLE')
    if (review.status !== 'OPEN' || !SOURCE_REVIEW_KINDS.includes(review.kind as typeof SOURCE_REVIEW_KINDS[number])) throw new Error('OPEN_SOURCE_REVIEW_REQUIRED')
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
    const resolutions=await resolveCatalogEntries(tx,entries)
    const selectedResolution=resolutions[entries.indexOf(selected)]
    if (!resolvedCatalogMasterCompatibility(master, selected, selectedResolution).compatible) throw new Error('INCOMPATIBLE_IDENTITY')
    if (entries.some((entry,index) => !resolvedCatalogMasterCompatibility(master, entry, resolutions[index]).compatible)) throw new Error('AMBIGUOUS_REVIEW_IDENTITY')

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
    if (!review) throw new Error('OPEN_LINKED_REVIEW_REQUIRED')
    if (isAttachedReview(review)) throw new Error('ATTACHED_REVIEW_IMMUTABLE')
    if (review.status !== 'OPEN' || !review.masterSwitch || !entry?.exists) throw new Error('OPEN_LINKED_REVIEW_REQUIRED')
    if (!candidateIds(review.payload).includes(entry.id) || review.catalogEntryId !== entry.id) throw new Error('REVIEW_CANDIDATE_REQUIRED')
    const resolution=await resolveUniqueCatalogMaster(tx,{...entry,technology:input.technology})
    if (normalize(input.manufacturer) !== normalize(review.masterSwitch.manufacturer) || input.technology !== review.masterSwitch.technology || !resolvedCatalogMasterCompatibility(review.masterSwitch,{...entry,technology:input.technology},resolution).compatible) throw new Error('INCOMPATIBLE_IDENTITY')
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
    if (!review) throw new Error('OPEN_REVIEW_REQUIRED')
    if (isAttachedReview(review)) throw new Error('ATTACHED_REVIEW_IMMUTABLE')
    if (review.status !== 'OPEN') throw new Error('OPEN_REVIEW_REQUIRED')
    if (!review.masterSwitchId || !review.masterSwitch) throw new Error('LINKED_MASTER_REQUIRED')
    const targetId = input.catalogEntryId || review.catalogEntryId || undefined
    const candidate = targetId ? await tx.forceCurveCatalogEntry.findUnique({ where: { id: targetId } }) : null
    if (input.resolution !== 'NO_MATCH') {
      if (!candidate || !candidate.exists || !candidateIds(review.payload).includes(candidate.id)) throw new Error('REVIEW_CANDIDATE_REQUIRED')
      const resolution=await resolveUniqueCatalogMaster(tx,candidate)
      if (!resolvedCatalogMasterCompatibility(review.masterSwitch,candidate,resolution).compatible) throw new Error('INCOMPATIBLE_IDENTITY')
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
