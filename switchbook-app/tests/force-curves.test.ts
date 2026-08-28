import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogUrl, classifyCatalogTree, collapseAutomaticCandidates, forceCurveSyncRevision, measurementDisplayName, resolveApprovedCurveRecords, selectAutomaticCandidates } from '../src/lib/force-curves'
import { adminActor, buildReviewQueue, exactCatalogMasterIdentity, isSameOriginMutation } from '../src/lib/admin-force-curves'
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
test('review queue reports conflicts separately',()=>{const queue=buildReviewQueue([queueReview(),queueReview({id:'r2',masterSwitchId:'m2',masterSwitch:{id:'m2',name:'Other',manufacturer:'KTT',technology:'MECHANICAL'}})]);assert.equal(queue.items[0].bucket,'CONFLICT');assert.equal(queue.remainingActionable,0)})
test('production-shaped candidate-less payload paths and measurement keys group repeated source evidence',()=>{const queue=buildReviewQueue([queueReview({id:'r1',masterSwitchId:null,masterSwitch:null,catalogEntryId:null,candidates:[],payload:{measurementKey:'BSUN Avocado Panda V2/bsun avocado panda v2',paths:['BSUN Avocado Panda V2/a.csv'],candidateIds:[]}}),queueReview({id:'r2',masterSwitchId:null,masterSwitch:null,catalogEntryId:null,candidates:[],payload:{measurementKey:'BSUN Avocado Panda V2/bsun avocado panda v2',paths:['BSUN Avocado Panda V2/b.csv'],candidateIds:[]}})]);assert.equal(queue.uniqueSourceCount,1);assert.equal(queue.rawReviewCount,2)})
test('candidate-less rows sharing only a master are not falsely grouped as one source',()=>{const queue=buildReviewQueue([queueReview({id:'r1',catalogEntryId:null,candidates:[],payload:{candidateIds:[]}}),queueReview({id:'r2',catalogEntryId:null,candidates:[],payload:{candidateIds:[]}})]);assert.equal(queue.uniqueSourceCount,2)})
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
test('admin mutation authorization denies anonymous/non-admin and requires exact same origin', () => {
  assert.equal(adminActor(null), null)
  assert.equal(adminActor({user:{id:'u1',role:'USER'}}), null)
  assert.equal(adminActor({user:{id:'a1',role:'ADMIN'}}), 'a1')
  const request = (origin: string | null) => ({headers:new Headers(origin ? {origin} : {}),nextUrl:new URL('https://switchbook.app/api/admin/force-curves/reviews')})
  assert.equal(isSameOriginMutation(request(null)), false)
  assert.equal(isSameOriginMutation(request('https://evil.example')), false)
  assert.equal(isSameOriginMutation(request('https://switchbook.app')), true)
})
test('manual source linking uses exact manufacturer/name folder identity and rejects fuzzy paths', () => {
  const production = [
    ['Gateron Oil King','Gateron Oil King/Gateron_Oil_King_HighResolutionRaw.csv'],
    ['Gateron Smoothie','Gateron Smoothie/Gateron_Smoothie_HighResolutionRaw.csv'],
    ['Gateron Magnetic Jade','Gateron Magnetic Jade/Gateron_Magnetic_Jade_HighResolutionRaw.csv'],
    ['Gateron G Pro 3.0 Yellow','Gateron G Pro 3.0 Yellow/Gateron_G_Pro_3.0_Yellow_HighResolutionRaw.csv'],
  ]
  for (const [name,repositoryPath] of production) assert.equal(exactCatalogMasterIdentity({name,manufacturer:'Gateron'},{displayName:name,repositoryPath}),true)
  assert.equal(exactCatalogMasterIdentity({name:'Oil King',manufacturer:'Gateron'},{displayName:'Gateron Oil King',repositoryPath:'Gateron Oil King/Gateron_Oil_King_HighResolutionRaw.csv'}),true)
  assert.equal(exactCatalogMasterIdentity({name:'Gateron Oil King',manufacturer:'Gateron'},{displayName:'Gateron Oil King V2',repositoryPath:'Gateron Oil King V2/TG.csv'}),false)
  assert.equal(exactCatalogMasterIdentity({name:'Gateron Oil King',manufacturer:'KTT'},{displayName:'Gateron Oil King',repositoryPath:'Gateron Oil King/TG.csv'}),false)
  assert.equal(exactCatalogMasterIdentity({name:'GateronX Oil King',manufacturer:'Gateron'},{displayName:'GateronX Oil King',repositoryPath:'GateronX Oil King/TG.csv'}),false)
  assert.equal(exactCatalogMasterIdentity({name:'Peach Blossom',manufacturer:'KTT'},{displayName:'Cherry Blossom',repositoryPath:'Cherry Blossom/TG.csv'}),false)
})
