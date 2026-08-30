import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogUrl, classifyCatalogTree, collapseAutomaticCandidates, forceCurveSyncRevision, measurementDisplayName, resolveApprovedCurveRecords, selectAutomaticCandidates } from '../src/lib/force-curves'
import { adminActor, buildReviewQueue, catalogMasterCompatibility, exactCatalogMasterIdentity, isSameOriginMutation, resolveUniqueCatalogMaster, uniqueCatalogMasterCompatibility } from '../src/lib/admin-force-curves'
import { getForceCurveReviewQueuePage } from '../src/lib/admin-force-curve-queue'
const master = { id: 'm1', name: 'Peach', manufacturer: 'KTT', technology: 'MECHANICAL' as const }
const curve = (overrides = {}) => ({ id: 'c1', displayName: 'KTT Peach', repositoryPath:'KTT Peach/KTT_Peach_HighResolutionRaw.csv', contentHash:'sha', manufacturer: 'KTT', technology: 'MECHANICAL' as const, metadataVerifiedAt: null, exists: true, ...overrides })
test('sync run identity deterministically versions upstream content and matching algorithm', () => {
  assert.equal(forceCurveSyncRevision('abc123'),'abc123:formats-v3:exact-match-v1')
  assert.equal(forceCurveSyncRevision('abc123'),forceCurveSyncRevision('abc123'))
  assert.notEqual(forceCurveSyncRevision('abc123'),'abc123:formats-v2')
})
test('automatic matching accepts one exact compatible candidate', () => assert.deepEqual(selectAutomaticCandidates(master, [curve()]).map(c => c.id), ['c1']))
test('automatic matching accepts an exact production name with its manufacturer already prefixed', () => assert.deepEqual(selectAutomaticCandidates({id:'oil',name:'Gateron Oil King',manufacturer:'Gateron',technology:'MECHANICAL'}, [curve({displayName:'Gateron Oil King',repositoryPath:'Gateron Oil King/Gateron_Oil_King_HighResolutionRaw.csv',manufacturer:'Gateron'})]).map(c => c.id), ['c1']))
test('automatic matching exposes ambiguity rather than choosing first', () => assert.equal(selectAutomaticCandidates(master, [curve(), curve({id:'c2'})]).length, 2))
test('one raw/high-resolution measurement selects high-resolution, while distinct legitimate measurements remain distinct', () => {
  const raw = curve({id:'raw',repositoryPath:'KTT Peach/KTT Peach Raw Data CSV.csv'})
  const high = curve({id:'high'})
  assert.deepEqual(collapseAutomaticCandidates([raw,high]).map(row=>row.id),['high'])
  assert.equal(collapseAutomaticCandidates([high,curve({id:'other',displayName:'KTT Peach Travel 2mm',repositoryPath:'KTT Peach Travel 2mm/KTT_Peach_Travel_2mm_HighResolutionRaw.csv'})]).length,2)
})
test('missing path evidence and manufacturer/technology conflicts fail closed while human metadata is not required', () => {
  assert.equal(selectAutomaticCandidates(master, [curve({exists:false})]).length, 0)
  assert.equal(selectAutomaticCandidates(master, [curve({manufacturer:'Cherry'})]).length, 0)
  assert.equal(selectAutomaticCandidates(master, [curve({technology:'MAGNETIC'})]).length, 0)
  assert.equal(selectAutomaticCandidates(master, [curve({repositoryPath:undefined})]).length, 0)
  assert.equal(selectAutomaticCandidates(master, [curve({contentHash:null})]).length, 0)
  assert.equal(selectAutomaticCandidates(master, [curve({manufacturer:null, technology:null, metadataVerifiedAt:null})]).length, 1)
})
test('exact TG.csv file identity is encoded segment-by-segment', () => assert.equal(catalogUrl('KTT Peach/TG.csv'), 'https://github.com/ThereminGoat/force-curves/blob/main/KTT%20Peach/TG.csv'))
test('approved read supports multiple curves and excludes stale/deleted rows', () => {
  const rows = ['c1','c2'].map(id => ({ state: 'MANUALLY_APPROVED' as const, catalogEntry: { id, displayName: id, repositoryPath: `${id}/TG.csv`, exists: true } }))
  assert.equal(resolveApprovedCurveRecords([...rows, { state: 'STALE', catalogEntry: { id:'c3',displayName:'c3',repositoryPath:'c3/TG.csv',exists:true } }]).length, 2)
  assert.equal(resolveApprovedCurveRecords([{ state: 'AUTO_APPROVED', catalogEntry: { id:'gone',displayName:'gone',repositoryPath:'gone/TG.csv',exists:false } }]).length, 0)
})
test('Peach Blossom behavior: durable NO_MATCH suppresses conflicting approval and yields no TG.csv URL', () => {
  const result = resolveApprovedCurveRecords([{ state: 'NO_MATCH', catalogEntry: null }, { state: 'AUTO_APPROVED', catalogEntry: { id:'bad',displayName:'Cherry Blossom',repositoryPath:'Cherry Blossom/TG.csv',exists:true } }])
  assert.deepEqual(result, []); assert.equal(JSON.stringify(result).includes('TG.csv'), false)
})

const queueReview=(overrides:Record<string,unknown>={})=>({id:'r1',kind:'SOURCE_UNVERIFIED',status:'OPEN',reason:'source evidence',masterSwitchId:'m1',catalogEntryId:'c1',payload:{candidateIds:['c1']},masterSwitch:{id:'m1',name:'Gateron Oil King',manufacturer:'Gateron',technology:'MECHANICAL'},candidates:[{id:'c1',displayName:'Gateron Oil King',repositoryPath:'Gateron Oil King/TG.csv',manufacturer:'Gateron',technology:'MECHANICAL',contentHash:'sha',revision:'rev',exists:true}],...overrides}) as any
test('review queue groups repeated source evidence and counts unique actionable work',()=>{const queue=buildReviewQueue([queueReview(),queueReview({id:'r2'})]);assert.equal(queue.rawReviewCount,2);assert.equal(queue.uniqueSourceCount,1);assert.equal(queue.remainingActionable,1);assert.equal(queue.items[0].bucket,'DUPLICATE');assert.equal(queue.items[0].confidence,1)})
test('review queue never calls ambiguity actionable',()=>{const queue=buildReviewQueue([queueReview({candidates:[queueReview().candidates[0],{...queueReview().candidates[0],id:'c2',repositoryPath:'Gateron Oil King/alternate.csv'}]})]);assert.equal(queue.items[0].bucket,'AMBIGUITY');assert.equal(queue.remainingActionable,0)})
test('review queue distinguishes unambiguous no-match and durable defer',()=>{const queue=buildReviewQueue([queueReview({kind:'UNMATCHED',reason:'no match',catalogEntryId:null,candidates:[],payload:{queueWorkflow:{status:'DEFERRED'}}})]);assert.equal(queue.items[0].bucket,'NO_MATCH');assert.equal(queue.items[0].deferred,true);assert.equal(queue.remainingActionable,0)})
test('attached evidence leaves adjudication open but clears the active queue',()=>{const queue=buildReviewQueue([queueReview({payload:{candidateIds:['c1'],queueWorkflow:{status:'ATTACHED'}}})]);assert.equal(queue.items[0].status,'RESOLVED');assert.equal(queue.items[0].attached,true);assert.equal(queue.openSourceCount,0);assert.equal(queue.resolvedSourceCount,1);assert.equal(queue.remainingActionable,0)})
test('review queue reports conflicts separately',()=>{const queue=buildReviewQueue([queueReview(),queueReview({id:'r2',masterSwitchId:'m2',masterSwitch:{id:'m2',name:'Other',manufacturer:'KTT',technology:'MECHANICAL'}})]);assert.equal(queue.items[0].bucket,'CONFLICT');assert.equal(queue.remainingActionable,0)})
test('production-shaped candidate-less payload paths and measurement keys group repeated source evidence',()=>{const queue=buildReviewQueue([queueReview({id:'r1',masterSwitchId:null,masterSwitch:null,catalogEntryId:null,candidates:[],payload:{measurementKey:'BSUN Avocado Panda V2/bsun avocado panda v2',paths:['BSUN Avocado Panda V2/a.csv'],candidateIds:[]}}),queueReview({id:'r2',masterSwitchId:null,masterSwitch:null,catalogEntryId:null,candidates:[],payload:{measurementKey:'BSUN Avocado Panda V2/bsun avocado panda v2',paths:['BSUN Avocado Panda V2/b.csv'],candidateIds:[]}})]);assert.equal(queue.uniqueSourceCount,1);assert.equal(queue.rawReviewCount,2)})
test('candidate-less rows sharing only a master are not falsely grouped as one source',()=>{const queue=buildReviewQueue([queueReview({id:'r1',catalogEntryId:null,candidates:[],payload:{candidateIds:[]}}),queueReview({id:'r2',catalogEntryId:null,candidates:[],payload:{candidateIds:[]}})]);assert.equal(queue.uniqueSourceCount,2)})
test('legacy candidateIds-only rows use loaded catalog paths as canonical source identity',()=>{const first=queueReview({id:'r1',masterSwitchId:null,masterSwitch:null}),second=queueReview({id:'r2',masterSwitchId:null,masterSwitch:null});const queue=buildReviewQueue([first,second]);assert.equal(queue.uniqueSourceCount,1);assert.equal(queue.items[0].evidence.length,2)})
test('active projection selects newer OPEN evidence instead of stale RESOLVED history',()=>{const stale=queueReview({id:'old',status:'RESOLVED',resolution:'MANUALLY_APPROVED',catalogEntryId:'old-candidate',candidates:[{...queueReview().candidates[0],id:'old-candidate'}]}),active=queueReview({id:'new',status:'OPEN'});const queue=buildReviewQueue([stale,active]);assert.equal(queue.uniqueSourceCount,1);assert.equal(queue.items[0].primaryReviewId,'new');assert.equal(queue.items[0].status,'OPEN');assert.equal(queue.items[0].actionable,true)})
test('actual upstream formats preserve exact path/hash and pair to one measurement', () => {
  const entries = classifyCatalogTree([
    {type:'blob',path:"'X' Green/'X' Green Raw Data CSV.csv",sha:'7be19f'},
    {type:'blob',path:"'X' Green/'X'_Green_HighResolutionRaw.csv",sha:'82bcbe'},
    {type:'blob',path:'ignore/readme.pdf',sha:'nope'},
  ])
  assert.equal(entries.length, 2)
  assert.deepEqual(entries.map(e => e.format), ['RAW_DATA','HIGH_RESOLUTION_RAW'])
  assert.equal(entries[0].measurementKey, entries[1].measurementKey)
  assert.equal(entries[0].path, "'X' Green/'X' Green Raw Data CSV.csv")
  assert.equal(entries[1].sha, '82bcbe')
})
test('single standard format is cataloged; construction and arbitrary CSVs are excluded while distinct measurements stay distinct', () => {
  const entries = classifyCatalogTree([
    {type:'blob',path:'Solo/Solo Raw Data CSV.csv',sha:'one'},
    {type:'blob',path:'Keyfirst Bling Green/Keyfirst Bling Green Data Construction.csv',sha:'two'},
    {type:'blob',path:'Arbitrary/Arbitrary.csv',sha:'excluded'},
    {type:'blob',path:'Many/Many Red Raw Data CSV.csv',sha:'three'},
    {type:'blob',path:'Many/Many_Blue_HighResolutionRaw.csv',sha:'four'},
  ])
  assert.equal(entries.length, 3)
  assert.equal(entries.some(entry => entry.sha === 'two'), false)
  assert.equal(entries.some(entry => entry.sha === 'excluded'), false)
  assert.notEqual(entries[1].measurementKey, entries[2].measurementKey)
  assert.equal(measurementDisplayName('Solo/Solo Raw Data CSV.csv'), 'Solo')
})
test('spring tester artifacts are excluded before standard suffix classification without excluding valid spring-named switches', () => {
  const springTesters = Array.from({length:68}, (_, index) => ({
    type:'blob',
    path:`SwitchOddities Spring Testers/Fixture ${index}/Spring ${index} Raw Data CSV.csv`,
    sha:`spring-${index}`,
  }))
  const entries = classifyCatalogTree([
    ...springTesters,
    {type:'blob',path:'Laboratory/Spring-Tester Calibration_HighResolutionRaw.csv',sha:'generic-tester'},
    {type:'blob',path:'Keyfirst Bling Green/Keyfirst Bling Green Data Construction.csv',sha:'construction'},
    {type:'blob',path:'Valid Spring Switch/Valid Spring Switch Raw Data CSV.csv',sha:'valid-spring-switch'},
    {type:'blob',path:'Tester Switch/Tester Switch Raw Data CSV.csv',sha:'valid-tester-switch'},
  ])
  assert.equal(entries.length, 2)
  assert.deepEqual(entries.map(entry => entry.sha), ['valid-spring-switch','valid-tester-switch'])
  assert.equal(entries.some(entry => entry.path.includes('SwitchOddities Spring Testers')), false)
})
test('KTT Peach Sun and other Blossom paths cannot auto-match Peach Blossom without verified exact metadata', () => {
  const peachBlossom = { id:'cmqo21sm103vknu3vh0tjs75x', name:'Peach Blossom', manufacturer:'KTT', technology:'MECHANICAL' as const }
  const paths = ['KTT Peach Sun/KTT_Peach_Sun_HighResolutionRaw.csv','Cherry Blossom/Cherry Blossom Raw Data CSV.csv','Jerrzi Cherry Blossom/Jerrzi_Cherry_Blossom_HighResolutionRaw.csv']
  const candidates = classifyCatalogTree(paths.map((path, i) => ({type:'blob',path,sha:String(i)}))).map((entry, i) => ({id:String(i),displayName:measurementDisplayName(entry.path),repositoryPath:entry.path,contentHash:entry.sha,manufacturer:null,technology:null,metadataVerifiedAt:null,exists:true}))
  assert.deepEqual(selectAutomaticCandidates(peachBlossom, candidates), [])
})
test('admin mutation authorization denies anonymous/non-admin and validates canonical proxy origin', () => {
  assert.equal(adminActor(null), null)
  assert.equal(adminActor({user:{id:'u1',role:'USER'}}), null)
  assert.equal(adminActor({user:{id:'a1',role:'ADMIN'}}), 'a1')
  const prior = process.env.NEXTAUTH_URL
  process.env.NEXTAUTH_URL = 'https://switchbook.app'
  const request = (origin: string | null, host='switchbook.app', proto='https') => ({headers:new Headers({...origin ? {origin} : {},host,'x-forwarded-host':host,'x-forwarded-proto':proto}),nextUrl:new URL('https://0.0.0.0:3000/api/admin/force-curves/reviews')})
  assert.equal(isSameOriginMutation(request(null)), false)
  assert.equal(isSameOriginMutation(request('https://evil.example')), false)
  assert.equal(isSameOriginMutation(request('https://switchbook.app')), true)
  assert.equal(isSameOriginMutation(request('not a url')), false)
  assert.equal(isSameOriginMutation(request('https://switchbook.app/forged-path')), false)
  assert.equal(isSameOriginMutation(request('https://user@switchbook.app')), false)
  assert.equal(isSameOriginMutation(request('https://switchbook.app','evil.example')), false)
  assert.equal(isSameOriginMutation(request('https://switchbook.app','switchbook.app','http')), false)
  assert.equal(isSameOriginMutation({headers:new Headers({origin:'https://switchbook.app',host:'switchbook.app'}),nextUrl:new URL('https://0.0.0.0:3000')}), false)
  if (prior === undefined) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = prior
})
test('review queue service projects with an ID map and bounds serialized page items while preserving global counts', async () => {
  const reviews = Array.from({length:250},(_,index)=>({id:`r${index}`,kind:'SOURCE_UNVERIFIED',status:'OPEN',resolution:null,reason:'source evidence',masterSwitchId:null,catalogEntryId:`c${index}`,payload:{measurementKey:`source/${index}`,candidateIds:[`c${index}`]},masterSwitch:null}))
  const candidates = Array.from({length:250},(_,index)=>({id:`c${index}`,displayName:`Switch ${index}`,repositoryPath:`Switch ${index}/TG.csv`,manufacturer:null,technology:null,contentHash:'sha',revision:'rev',exists:true}))
  const calls:any[]=[]
  const version={_count:{_all:250},_max:{updatedAt:new Date(1)}}
  const db={forceCurveReviewCase:{aggregate:async()=>version,findMany:async(options:any)=>{calls.push(options);return reviews}},forceCurveCatalogEntry:{aggregate:async()=>version,findMany:async(options:any)=>{calls.push(options);return candidates}},masterSwitch:{aggregate:async()=>({_count:{_all:0},_max:{updatedAt:null}})}} as any
  const page=await getForceCurveReviewQueuePage({page:2,pageSize:100,status:'OPEN'},db)
  assert.equal(page.rawReviewCount,250)
  assert.equal(page.uniqueSourceCount,250)
  assert.equal(page.filteredSourceCount,250)
  assert.equal(page.items.length,100)
  assert.equal(page.pagination.pageCount,3)
  assert.equal(page.items[0].evidence[0].candidates[0].id,page.items[0].evidence[0].catalogEntryId)
  assert.equal(calls.length,2)
  assert.ok(calls[0].select)
  assert.ok(calls[1].select)
  assert.equal('payload' in page.items[0].evidence[0],false)
  assert.equal('exists' in page.items[0].evidence[0].candidates[0],false)
  assert.ok(Buffer.byteLength(JSON.stringify(page)) < 250_000)
})
test('production-cardinality queue cache preserves truth and bounds warm latency and response shape', async () => {
  const sourceCount=5484,openSourceCount=2725,rawReviewCount=10512
  const candidates=Array.from({length:sourceCount},(_,i)=>({id:`c${i}`,displayName:`Switch ${i}`,repositoryPath:`Switch ${i}/TG.csv`,manufacturer:null,technology:null,contentHash:`sha-${i}`,revision:'rev',exists:true}))
  const reviews=Array.from({length:rawReviewCount},(_,i)=>{const source=i<sourceCount?i:i-sourceCount;return {id:`r${i}`,kind:'SOURCE_UNVERIFIED',status:source<openSourceCount?'OPEN':'RESOLVED',resolution:null,reason:`source evidence ${i}`,masterSwitchId:null,catalogEntryId:`c${source}`,payload:{measurementKey:`source/${source}`,candidateIds:[`c${source}`],diagnostic:'x'.repeat(900)},masterSwitch:null}})
  let version={_count:{_all:rawReviewCount},_max:{updatedAt:new Date(1)}}
  let reviewLoads=0,candidateLoads=0
  const db={forceCurveReviewCase:{aggregate:async()=>version,findMany:async()=>{reviewLoads++;return reviews}},forceCurveCatalogEntry:{aggregate:async()=>({_count:{_all:sourceCount},_max:{updatedAt:new Date(1)}}),findMany:async()=>{candidateLoads++;return candidates}},masterSwitch:{aggregate:async()=>({_count:{_all:0},_max:{updatedAt:null}})}} as any
  const cold=await getForceCurveReviewQueuePage({page:1,pageSize:50,bucket:'ALL',status:'OPEN'},db)
  const samples:number[]=[]
  for(let i=0;i<8;i++){const started=performance.now();const page=await getForceCurveReviewQueuePage({page:1,pageSize:50,bucket:'ALL',status:'OPEN'},db);samples.push(performance.now()-started);assert.deepEqual([page.rawReviewCount,page.uniqueSourceCount,page.openSourceCount,page.filteredSourceCount,page.items.length,page.pagination.pageCount],[10512,5484,2725,2725,50,55]);assert.ok(Buffer.byteLength(JSON.stringify(page))<200_000)}
  assert.deepEqual([cold.rawReviewCount,cold.uniqueSourceCount,cold.openSourceCount],[10512,5484,2725])
  const searched=await getForceCurveReviewQueuePage({query:'measurement:source 5483',status:'RESOLVED',bucket:'OTHER'},db)
  assert.deepEqual([searched.filteredSourceCount,searched.items.length,searched.items[0].sourceKey],[1,1,'measurement:source 5483'])
  assert.equal(reviewLoads,1);assert.equal(candidateLoads,1)
  assert.ok(Math.max(...samples)<750,`warm queue service exceeded 750ms: ${samples.join(', ')}`)
  version={_count:{_all:rawReviewCount},_max:{updatedAt:new Date(2)}}
  await getForceCurveReviewQueuePage({status:'OPEN'},db)
  assert.equal(reviewLoads,2);assert.equal(candidateLoads,2)
})
test('manual source linking uses ordered product identity and rejects variant or malformed folder paths', () => {
  const production = [
    ['Gateron Oil King','Gateron Oil King/Gateron_Oil_King_HighResolutionRaw.csv'],
    ['Gateron Smoothie','Gateron Smoothie/Gateron_Smoothie_HighResolutionRaw.csv'],
    ['Gateron Magnetic Jade','Gateron Magnetic Jade/Gateron_Magnetic_Jade_HighResolutionRaw.csv'],
    ['Gateron G Pro 3.0 Yellow','Gateron G Pro 3.0 Yellow/Gateron_G_Pro_3.0_Yellow_HighResolutionRaw.csv'],
  ]
  for (const [name,repositoryPath] of production) assert.equal(exactCatalogMasterIdentity({name,manufacturer:'Gateron'},{displayName:name,repositoryPath}),true)
  assert.equal(catalogMasterCompatibility({name:'Oil King',manufacturer:'Gateron'},{displayName:'Gateron Oil King',repositoryPath:'Gateron Oil King/Gateron_Oil_King_HighResolutionRaw.csv'},[{name:'Gateron'}]).compatible,true)
  assert.equal(exactCatalogMasterIdentity({name:'Gateron Oil King',manufacturer:'Gateron'},{displayName:'Gateron Oil King V2',repositoryPath:'Gateron Oil King V2/TG.csv'}),false)
  const known=[{name:'Gateron'},{name:'KTT'},{name:'BSUN'},{name:'Aflion'},{name:'HMX'}]
  assert.equal(catalogMasterCompatibility({name:'Gateron Oil King',manufacturer:'KTT'},{displayName:'Gateron Oil King',repositoryPath:'Gateron Oil King/TG.csv'},known).compatible,false)
  assert.equal(catalogMasterCompatibility({name:'Raw Tactile',manufacturer:'Aflion'},{displayName:'BSUN Raw Tactile',repositoryPath:'BSUN Raw Tactile/TG.csv'},known).compatible,false)
  assert.equal(catalogMasterCompatibility({name:'Oil King',manufacturer:'Gateron'},{displayName:'Gateron Oil King',repositoryPath:'Gateron Oil King/TG.csv'},known).compatible,true)
  assert.equal(exactCatalogMasterIdentity({name:'Peach Blossom',manufacturer:'KTT'},{displayName:'Cherry Blossom',repositoryPath:'Cherry Blossom/TG.csv'}),false)
  assert.equal(catalogMasterCompatibility({name:'Xinhai 37g',manufacturer:'HMX'},{displayName:'HMX Xinhai 37 g',repositoryPath:'HMX Xinhai 37-g/TG.csv'},known).compatible,true)
  assert.equal(exactCatalogMasterIdentity({name:'Greetech GT-01',manufacturer:null},{displayName:'Greetech GT01',repositoryPath:'Greetech GT01/TG.csv'}),true)
})
test('80Retros Game1989 accepts the full product identity while blocking siblings and shortened names', () => {
  const conflicted = { name: '80Retros KTT Game1989 Retro Blue', manufacturer: 'KTT' }
  const entry = { displayName: '80Retros 1989 Retro Blue', repositoryPath: '80Retros 1989 Retro Blue/80Retros_1989_Retro_Blue_HighResolutionRaw.csv' }
  assert.equal(catalogMasterCompatibility(conflicted, entry).compatible, true)
  assert.match(catalogMasterCompatibility(conflicted, entry).reason, /80, retros, 1989, retro, blue/)
  assert.equal(exactCatalogMasterIdentity(conflicted, entry), true)
  assert.equal(exactCatalogMasterIdentity({ name: '80Retros KTT 1989 Retro Blue', manufacturer: 'KTT' }, entry), true)
  assert.equal(exactCatalogMasterIdentity({ name: 'KTT Retro Blue', manufacturer: 'KTT' }, entry), false)
  assert.equal(exactCatalogMasterIdentity({ name: 'HMX 80Retros GAME1989', manufacturer: 'HMX' }, entry), false)
  for (const color of ['Orange','Red','White','Silver']) assert.equal(exactCatalogMasterIdentity({ name: `80Retros KTT Game1989 Retro ${color}`, manufacturer: 'KTT' }, entry), false)
  assert.equal(exactCatalogMasterIdentity(conflicted, { ...entry, displayName: '80Retros 1989 Retro Red', repositoryPath: '80Retros 1989 Retro Red/TG.csv' }), false)
  const masters=[{id:'right',...conflicted},{id:'hmx',name:'HMX 80Retros GAME1989',manufacturer:'HMX'}]
  assert.equal(uniqueCatalogMasterCompatibility({id:'right',...conflicted},entry,[{name:'KTT'},{name:'HMX'}],masters).compatible,true)
  assert.equal(uniqueCatalogMasterCompatibility({id:'a',name:'Generic',manufacturer:'KTT'},{displayName:'Generic',repositoryPath:'Generic/TG.csv'},[],[{id:'a',name:'Generic',manufacturer:'KTT'},{id:'b',name:'Generic',manufacturer:'HMX'}]).compatible,false)
})
test('80Retros Retro family preserves each variant when resolving GAME1989 aliases', async () => {
  const { catalogMasterSearchTerms } = await import('../src/lib/admin-force-curves')
  const entry = { displayName: '80Retros Retro Orange', repositoryPath: '80Retros Retro Orange/80Retros_Retro_Orange_HighResolutionRaw.csv', technology: 'MECHANICAL' as const }
  const right = { id: 'right-orange', name: '80Retros GAME1989 Orange', manufacturer: 'KTT', technology: 'MECHANICAL' as const }
  assert.equal(catalogMasterCompatibility(right, entry, [{name:'KTT'},{name:'HMX'}]).compatible, true)
  assert.equal(uniqueCatalogMasterCompatibility(right, entry, [{name:'KTT'},{name:'HMX'}], [right]).compatible, true)
  assert.deepEqual(catalogMasterSearchTerms('80Retros Retro Orange', entry), ['80Retros Retro Orange', '80Retros GAME1989 Orange'])
  assert.deepEqual(catalogMasterSearchTerms('Retro Orange', entry), ['Retro Orange', '80Retros GAME1989 Orange'])
  assert.deepEqual(catalogMasterSearchTerms('HMX', entry), ['HMX'])
  const redEntry = { displayName: '80Retros Retro Red', repositoryPath: '80Retros Retro Red/80Retros_Retro_Red_HighResolutionRaw.csv', technology: 'MECHANICAL' as const }
  const red = { id: 'right-red', name: '80Retros GAME1989 Red', manufacturer: 'KTT', technology: 'MECHANICAL' as const }
  assert.equal(catalogMasterCompatibility(red, redEntry, [{name:'KTT'},{name:'HMX'}]).compatible, true)
  assert.equal(catalogMasterCompatibility(right, redEntry, [{name:'KTT'},{name:'HMX'}]).compatible, false)
  assert.deepEqual(catalogMasterSearchTerms('80Retros Retro Red', redEntry), ['80Retros Retro Red', '80Retros GAME1989 Red'])
  assert.deepEqual(catalogMasterSearchTerms('Retro Red', redEntry), ['Retro Red', '80Retros GAME1989 Red'])
  const redCalls:any[]=[]
  const redResolution=await resolveUniqueCatalogMaster({manufacturer:{findMany:async()=>[{name:'KTT',aliases:[]},{name:'HMX',aliases:[]}]},masterSwitch:{findMany:async(args:any)=>{redCalls.push(args);return [red]}}},redEntry)
  assert.equal(redResolution.uniqueMasterId,red.id)
  assert.equal(redCalls[0].where.name.contains,'retros')
  for (const wrong of [
    {name:'80Retros GAME1989 Red',manufacturer:'KTT'},
    {name:'80Retros GAME1989 Orange',manufacturer:'HMX'},
    {name:'80Retros Retro Orange V2',manufacturer:'KTT'},
    {name:'80Retros GAME1989 White',manufacturer:'KTT'},
  ]) assert.equal(catalogMasterCompatibility(wrong, entry, [{name:'KTT'},{name:'HMX'}]).compatible, false)
  const unrelatedEntry={displayName:'Gateron Oil King',repositoryPath:'Gateron Oil King/TG.csv',technology:'MECHANICAL' as const}
  assert.equal(catalogMasterCompatibility({name:'Oil King',manufacturer:'Gateron',technology:'MECHANICAL'},unrelatedEntry,[{name:'Gateron'}]).compatible,true)
  const calls:any[]=[]
  const resolution=await resolveUniqueCatalogMaster({manufacturer:{findMany:async()=>[{name:'KTT',aliases:[]},{name:'HMX',aliases:[]}]},masterSwitch:{findMany:async(args:any)=>{calls.push(args);return [right]}}},entry)
  assert.equal(resolution.uniqueMasterId,right.id)
  assert.equal(calls[0].where.name.contains,'orange')
})
test('authoritative compatibility resolver uses a bounded mandatory-anchor query and fails closed at its cap', async () => {
  const calls:any[]=[]
  const db={manufacturer:{findMany:async()=>[{name:'KTT',aliases:[]},{name:'HMX',aliases:[]}]},masterSwitch:{findMany:async(args:any)=>{calls.push(args);return [{id:'right',name:'80Retros KTT Game1989 Retro Blue',manufacturer:'KTT',technology:'MECHANICAL'}]}}}
  const entry={displayName:'80Retros 1989 Retro Blue',repositoryPath:'80Retros 1989 Retro Blue/TG.csv',technology:'MECHANICAL' as const}
  assert.equal((await resolveUniqueCatalogMaster(db,entry)).uniqueMasterId,'right')
  assert.deepEqual(calls[0].where,{status:'APPROVED',name:{contains:'retros',mode:'insensitive'}})
  assert.equal(calls[0].take,201)
  const overflow={...db,masterSwitch:{findMany:async()=>Array.from({length:201},(_,i)=>({id:`m${i}`,name:`80Retros ${i} 1989 Retro Blue`,manufacturer:'KTT',technology:'MECHANICAL'}))}}
  const resolution=await resolveUniqueCatalogMaster(overflow,entry)
  assert.equal(resolution.uniqueMasterId,null)
  assert.match(resolution.reason,/more than 200/)
})
