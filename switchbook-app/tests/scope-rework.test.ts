import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { Prisma } from '@prisma/client'
import { switchSchema } from '../src/lib/validation'
import { transformSwitchData } from '../src/utils/dataTransform'
import { csvRowToSwitchData, mapSwitchCsvHeaders, parseCsv, parseSwitchCsvRow, switchesToCsv } from '../src/lib/switchCsv'
import { resolveImportIdentities } from '../src/lib/switch-import-identity'
import { compareQuantity, summarizeQuantity, requestCollectionQuantity } from '../src/lib/collection-quantity'
import { MASTER_TRACKED_FIELDS, computeMasterModifiedFields, copyMasterFields } from '../src/lib/master-switch-modifications'
import { imageReferenceSchema, exportImageReferences } from '../src/lib/switch-image-references'
import { masterFieldsToForm } from '../src/lib/master-switch-form'
import { renderSwitchLabel } from '../src/lib/switch-label'

const requireNative = createRequire(import.meta.url)
const bundles = new Map<string, ReturnType<typeof build>>()
async function route(path: string, db: any, overrides: Record<string, unknown> = {}) {
  if (!bundles.has(path)) bundles.set(path, build({ entryPoints: [path], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'boundaries', setup(b) { b.onResolve({ filter: /^@\/lib\/(auth|prisma|with-rate-limit|performance-monitor|local-storage|image-utils|rate-limit)$/ }, args => ({ path: args.path, external: true })) } }] }))
  const dependencies: Record<string, unknown> = {
    '@/lib/auth': { auth: async () => ({ user: { id: 'owner' } }) }, '@/lib/prisma': { prisma: db },
    '@/lib/with-rate-limit': { withSmartRateLimit: (f: unknown) => f },
    '@/lib/performance-monitor': { BulkOperationMonitor: class { addError() {} complete() { return {} } } },
    '@/lib/local-storage': { deleteFile: async () => { throw new Error('unexpected physical deletion') } },
    '@/lib/image-utils': {}, '@/lib/rate-limit': {}, ...overrides,
  }
  const mod = { exports: {} as any }
  new Function('require', 'module', 'exports', 'setInterval', (await bundles.get(path)!).outputFiles![0].text)(
    (key: string) => dependencies[key] ?? requireNative(key), mod, mod.exports, () => 0)
  return mod.exports
}
const req = (body: unknown, method = 'PUT') => new Request('http://localhost/api/switches/owned', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
const params = { params: Promise.resolve({ id: 'owned' }) }
const numeric = ['actuationForce', 'bottomOutForce', 'tactileForce', 'tactilePosition', 'preTravel', 'bottomOut', 'initialForce', 'initialMagneticFlux', 'bottomOutMagneticFlux']
function fixture(linked = false) {
  const fields: Record<string, unknown> = {}
  for (const key of Object.keys(switchSchema.shape)) fields[key] = numeric.includes(key) ? 12.125 : `  ${key} text  `
  Object.assign(fields, { name: 'Same', type: 'TACTILE', technology: 'MAGNETIC', clickType: 'CLICK_BAR', progressiveSpring: true, doubleStage: true, quantity: 7, personalTags: [' x ', 'a,b'], dateObtained: new Date('2024-01-01T12:13:14.123Z'), notes: ' n \r\n'.repeat(5000), personalNotes: ' p \n'.repeat(5000) })
  let row: any = { ...fields, id: 'owned', userId: 'owner', masterSwitchId: linked ? 'master' : null, masterSwitchVersion: 1, primaryImageId: 'old-image', imageUrl: '/uploads/legacy.jpg', images: [{ id: 'old-image', switchId: 'owned', url: '/uploads/old.jpg', type: 'UPLOADED', order: 1 }] }
  const master: any = { ...fields, id: 'master', status: 'APPROVED', version: 3, images: [{ id: 'master-image', url: '/uploads/master.jpg', type: 'LINKED', order: 0 }], imageUrl: '/uploads/master.jpg' }
  const writes: any[] = [], relationQueries: any[] = [], masterWrites: any[] = []
  let seq = 0, transactions = 0
  const withImages = (images: any[]) => images.map(image => ({ ...image, id: image.id ?? `fresh-${++seq}`, switchId: row.id, masterSwitchId: null }))
  const db: any = {
    switch: {
      count: async () => 1,
      findFirst: async ({ where }: any) => where.id === row.id && where.userId === 'owner' ? { ...row } : null,
      findUnique: async () => ({ ...row }),
      create: async ({ data }: any) => { writes.push(data); row = { ...data, id: 'fresh-switch', primaryImageId: null, images: withImages(data.images?.create ?? []) }; return { ...row } },
      update: async ({ data }: any) => { writes.push(data); const { images, ...scalar } = data; Object.assign(row, Object.fromEntries(Object.entries(scalar).filter(([, v]) => v !== undefined))); if (images?.create) row.images = withImages(images.create); return { ...row } },
    },
    masterSwitch: { findUnique: async () => master, findFirst: async () => master, update: async ({ data }: any) => { masterWrites.push(data); return master }, count: async () => 0 },
    masterSwitchView: { findFirst: async () => ({ id: 'view' }) },
    switchImage: {
      updateMany: async (query: any) => { relationQueries.push(query); return { count: 0 } },
      deleteMany: async (query: any) => { relationQueries.push(query); row.images = []; return { count: 1 } },
      create: async ({ data }: any) => ({ ...data, id: `fresh-${++seq}` }),
    },
    $transaction: async (f: any) => { transactions++; const before = structuredClone(row); try { return await f(db) } catch (e) { row = before; throw e } },
  }
  return { db, master, row: () => row, writes, relationQueries, masterWrites, transactions: () => transactions }
}

for (const bulk of [false, true]) test(`${bulk ? 'bulk' : 'single'} real PUT preserves every omitted scalar and long legacy value`, async () => {
  const f = fixture(true), before = structuredClone(f.row())
  const r = await route(bulk ? 'src/app/api/switches/bulk/route.ts' : 'src/app/api/switches/[id]/route.ts', f.db)
  const body = bulk ? { switches: [{ id: 'owned', quantity: 0 }] } : { quantity: 0 }
  const res = await r.PUT(req(body), params)
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()))
  assert.equal(f.row().quantity, 0)
  for (const field of Object.keys(switchSchema.shape).filter(key => key !== 'quantity')) assert.deepEqual(f.row()[field], before[field], field)
  assert.deepEqual(f.row().modifiedFields, [])
  assert.equal(f.masterWrites.length, 0)
})

test('all mapped scalar blanks clear while omitted and short cells preserve', async () => {
  const f = fixture()
  const headers = Object.keys(switchSchema.shape).filter(key => key !== 'name')
  const data = parseSwitchCsvRow(['Same', ...headers.map(() => '')], mapSwitchCsvHeaders(['Switch Name', ...headers])).data
  const r = await route('src/app/api/switches/[id]/route.ts', f.db)
  assert.equal((await r.PUT(req(data), params)).status, 200)
  for (const field of headers) assert.deepEqual(f.row()[field], ['progressiveSpring', 'doubleStage'].includes(field) ? false : field === 'personalTags' ? [] : null, field)
  assert.deepEqual(csvRowToSwitchData(['Same'], mapSwitchCsvHeaders(['Switch Name', 'Notes', 'Quantity'])), { name: 'Same' })
})

test('native CSV preserves whitespace, long fields, measurements and full timestamp through real POST', async () => {
  const f = fixture()
  const original = { ...f.row(), name: '  Same  ', manufacturer: '  legacy alias  ', springWeight: '45 G', magnetPolarity: ' n ', notes: ' \r\n ', imageUrl: '/uploads/legacy.jpg', primaryImageId: null, images: [] }
  const [headers, cells] = parseCsv(switchesToCsv([original]))
  const parsed = parseSwitchCsvRow(cells, mapSwitchCsvHeaders(headers))
  assert.deepEqual(parsed.errors, {})
  const r = await route('src/app/api/switches/route.ts', f.db)
  assert.equal((await r.POST(req(parsed.data, 'POST'))).status, 200)
  for (const key of Object.keys(switchSchema.shape)) assert.deepEqual(f.row()[key], original[key], key)
  assert.notEqual(f.row().id, original.id)
})

test('nonfinite and malformed numeric/boolean/quoted input blocks instead of silently rewriting', () => {
  for (const value of [Infinity, -Infinity]) assert.equal(switchSchema.safeParse({ name: 'x', initialForce: value }).success, false)
  assert.ok(parseSwitchCsvRow(['12junk'], { '0': 'actuationForce' }).errors.actuationForce)
  assert.ok(parseSwitchCsvRow(['maybe'], { '0': 'doubleStage' }).errors.doubleStage)
  assert.throws(() => parseCsv('Name,Notes\nX,"unterminated'), /Unclosed/)
})

test('owned IDs alone resolve variants; missing/foreign/edited/repeated identities cannot overwrite', () => {
  const owned = [{ id: 'a', name: 'Same', manufacturer: 'A' }, { id: 'b', name: 'Same', manufacturer: 'B' }, { id: 'c', name: 'Same', manufacturer: 'A' }]
  for (const row of [{ name: 'Same', manufacturer: 'A' }, { id: 'foreign', name: 'Same' }, { id: 'a', name: 'Edited', manufacturer: 'A' }, { id: 'a', name: 'Same', manufacturer: 'B' }]) {
    const [resolved] = resolveImportIdentities([row], owned)
    assert.equal(resolved.existingId, undefined)
    assert.equal(resolved.isDuplicate, true)
  }
  assert.equal(resolveImportIdentities([{ id: 'c', name: 'Same', manufacturer: 'A' }], owned)[0].existingId, 'c')
  assert.ok(resolveImportIdentities([{ id: 'a', name: 'Same' }, { id: 'a', name: 'Same' }], owned).every(row => row.existingId === undefined && row.isDuplicate))
  assert.ok(resolveImportIdentities([{ name: 'New' }, { name: 'New' }], []).every(row => row.isDuplicate && !row.existingId))
})

test('real routes reject foreign targets, inconsistent identity and repeated bulk targets before writes', async () => {
  const f = fixture(), r = await route('src/app/api/switches/[id]/route.ts', f.db)
  assert.equal((await r.PUT(req({ quantity: 0 }), { params: Promise.resolve({ id: 'foreign' }) })).status, 404)
  assert.equal((await r.PUT(req({ id: 'different', quantity: 0 }), params)).status, 400)
  const bulk = await route('src/app/api/switches/bulk/route.ts', f.db)
  assert.equal((await bulk.PUT(req({ switches: [{ id: 'owned', quantity: 1 }, { id: 'owned', quantity: 2 }] }))).status, 400)
  assert.equal(f.writes.length, 0)
})

const gallery = [
  { url: '/uploads/switches/original/photo.jpg', type: 'UPLOADED' as const, order: 8, caption: '  Caption\r\n🎹 ', altText: 'side view', primary: true, remoteUrl: 'https://example.com/original.jpg', sourceUrl: 'https://example.com/source', sourceName: 'Photographer', license: 'CC BY', attribution: '  credit ', width: 100, height: 150, size: 1234 },
  { url: 'https://example.com/front.jpg', type: 'LINKED' as const, order: 1, caption: 'Front', primary: false },
]
for (const linked of [false, true]) test(`CSV gallery roundtrip ${linked ? 'linked' : 'unlinked'} keeps personal metadata, order and primary with fresh IDs`, async () => {
  const f = fixture(linked)
  const original = { ...f.row(), primaryImageId: 'old-0', images: gallery.map((image, i) => ({ ...image, id: `old-${i}`, switchId: 'foreign-switch', masterSwitchId: 'foreign-master' })) }
  const [headers, cells] = parseCsv(switchesToCsv([original]))
  const data = csvRowToSwitchData(cells, mapSwitchCsvHeaders(headers))
  assert.deepEqual(data.imageReferences, exportImageReferences(original))
  const r = await route('src/app/api/switches/route.ts', f.db)
  const res = await r.POST(req(data, 'POST'))
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()))
  assert.equal(f.row().imageUrl, original.imageUrl)
  assert.equal(f.row().images.length, 2)
  for (const image of f.row().images) { assert.ok(!['old-0', 'old-1', 'master-image'].includes(image.id)); assert.equal(image.masterSwitchId, null) }
  assert.equal(f.row().images.find((image: any) => image.id === f.row().primaryImageId).url, gallery[0].url)
  for (const [i, image] of f.row().images.entries()) for (const key of Object.keys(gallery[i]).filter(key => key !== 'primary')) assert.deepEqual(image[key], (gallery[i] as any)[key], key)
  assert.equal(f.masterWrites.length, 0)
  assert.equal(f.transactions(), 1)
})

test('omitted gallery preserves existing, explicit empty clears, and linked empty never inherits master photos', async () => {
  const f = fixture(true), r = await route('src/app/api/switches/[id]/route.ts', f.db)
  const before = structuredClone(f.row().images)
  assert.equal((await r.PUT(req({ quantity: 0 }), params)).status, 200)
  assert.deepEqual(f.row().images, before)
  assert.equal(f.relationQueries.length, 0)
  assert.equal((await r.PUT(req({ imageReferences: [] }), params)).status, 200)
  assert.deepEqual(f.row().images, [])
  assert.equal(f.row().primaryImageId, null)
  assert.equal(f.row().imageUrl, '/uploads/legacy.jpg', 'legacy URL omitted independently')
  assert.equal((await r.PUT(req({ imageUrl: '' }), params)).status, 200)
  assert.equal(f.row().imageUrl, null)
  assert.deepEqual(f.relationQueries[0].where, { switchId: 'owned', masterSwitchId: { not: null } })
  assert.deepEqual(f.relationQueries[1].where, { switchId: 'owned', masterSwitchId: null })
  const create = await route('src/app/api/switches/route.ts', f.db)
  assert.equal((await create.POST(req({ name: 'Empty', masterSwitchId: 'master', imageReferences: [] }, 'POST'))).status, 200)
  assert.deepEqual(f.row().images, [])
})

test('gallery overwrite uses fresh owned relations and image failures roll back scalar updates', async () => {
  const f = fixture(), r = await route('src/app/api/switches/[id]/route.ts', f.db)
  assert.equal((await r.PUT(req({ imageReferences: gallery }), params)).status, 200)
  assert.equal(f.row().images.find((image: any) => image.id === f.row().primaryImageId).caption, gallery[0].caption)
  const before = structuredClone(f.row())
  f.db.switchImage.deleteMany = async () => { throw new Error('database failure') }
  assert.equal((await r.PUT(req({ quantity: 99, imageReferences: [] }), params)).status, 500)
  assert.deepEqual(f.row(), before)
})

test('image restore rejects injected ownership/IDs, traversal and non-HTTP protocols before mutation', async () => {
  const f = fixture(), r = await route('src/app/api/switches/route.ts', f.db)
  for (const patch of [{ id: 'stolen' }, { switchId: 'foreign' }, { masterSwitchId: 'foreign' }, { url: '/uploads/../secret' }, { url: 'file:///etc/passwd' }, { url: 'javascript:alert(1)' }]) {
    assert.equal((await r.POST(req({ name: 'X', imageReferences: [{ ...gallery[0], ...patch }] }, 'POST'))).status, 400)
  }
  assert.equal((await r.POST(req({ name: 'X', imageReferences: [gallery[0], gallery[0]] }, 'POST'))).status, 400)
  assert.equal(f.writes.length, 0)
})

test('image metadata matrix covers every SwitchImage member or an explicit derived/ownership exclusion', () => {
  const excluded = ['id', 'switchId', 'masterSwitchId', 'uploadedAt', 'checksumSha256', 'revision', 'masterSwitch', 'switch', 'partnerSubmissionPhotos']
  const model = Prisma.dmmf.datamodel.models.find(model => model.name === 'SwitchImage')!
  assert.deepEqual(model.fields.map(field => field.name).filter(key => !(key in imageReferenceSchema.shape) && !excluded.includes(key)), [])
})

test('modified fields and copy contract cover all shared scalar specs, never inventory or personal data', () => {
  const f = fixture(true)
  const shared = Prisma.dmmf.datamodel.models.find(model => model.name === 'Switch')!.fields
    .filter(field => MASTER_TRACKED_FIELDS.includes(field.name as any)).map(field => field.name)
  assert.equal(shared.length, MASTER_TRACKED_FIELDS.length)
  for (const key of ['tactilePosition', 'frankenTop', 'frankenBottom', 'frankenStem']) {
    assert.deepEqual(computeMasterModifiedFields({ ...f.master, [key]: 'changed' }, f.master), [key])
  }
  const copied = copyMasterFields(f.master)
  for (const key of ['quantity', 'personalNotes', 'personalTags', 'imageUrl', 'primaryImageId', 'dateObtained']) assert.equal(key in copied, false)
})

for (const kind of ['single', 'bulk', 'notes']) test(`${kind} partial update recomputes against merged row and current master`, async () => {
  const f = fixture(true)
  const path = kind === 'bulk' ? 'src/app/api/switches/bulk/route.ts' : kind === 'notes' ? 'src/app/api/switches/[id]/update-notes/route.ts' : 'src/app/api/switches/[id]/route.ts'
  const r = await route(path, f.db)
  const update = kind === 'notes' ? { notes: 'changed' } : { tactilePosition: 0, frankenTop: 'changed' }
  const body = kind === 'bulk' ? { switches: [{ id: 'owned', ...update }] } : update
  const res = kind === 'notes' ? await r.PATCH(req(body, 'PATCH'), params) : await r.PUT(req(body), params)
  assert.equal(res.status, 200)
  assert.equal(f.row().isModified, true)
  assert.deepEqual(new Set(f.row().modifiedFields), new Set(Object.keys(update)))
  assert.equal(f.row().personalNotes, f.master.personalNotes)
})

test('quantity sort is numeric with unknown last both ways; totals distinguish zero and unknown', () => {
  const rows = [{ quantity: null }, { quantity: 10 }, { quantity: 0 }, { quantity: 2 }, {}]
  assert.deepEqual([...rows].sort((a,b) => compareQuantity(a,b,'asc')).map(row => row.quantity), [0,2,10,null,undefined])
  assert.deepEqual([...rows].sort((a,b) => compareQuantity(a,b,'desc')).map(row => row.quantity), [10,2,0,null,undefined])
  assert.deepEqual(summarizeQuantity(rows), { knownUnits: 12, unknownEntries: 2 })
  assert.deepEqual(summarizeQuantity([]), { knownUnits: 0, unknownEntries: 0 })
})

test('catalog quantity confirmation treats blank as unknown, cancel as no add, rejects invalid input', () => {
  const errors: string[] = []
  assert.equal(requestCollectionQuantity(() => '0', message => errors.push(message)), 0)
  assert.equal(requestCollectionQuantity(() => '', message => errors.push(message)), null)
  assert.equal(requestCollectionQuantity(() => null, message => errors.push(message)), undefined)
  for (const bad of ['-1','1.5','1000001','bad']) assert.equal(requestCollectionQuantity(() => bad, message => errors.push(message)), undefined)
  assert.equal(errors.length, 4)
})

for (const quantity of [undefined, null, 0, 12, -1, 1.5, 1000001]) test(`catalog real add validates quantity ${quantity}, never writes it to master`, async () => {
  const f = fixture(), r = await route('src/app/api/master-switches/[id]/add-to-collection/route.ts', f.db)
  f.master.images = []; f.master.imageUrl = null
  const res = await r.POST(req({ quantity }, 'POST'), { params: Promise.resolve({ id: 'master' }) })
  const valid = quantity == null || quantity === 0 || quantity === 12
  assert.equal(res.status, valid ? 200 : 400, JSON.stringify(await res.clone().json()))
  if (valid) { assert.equal(f.row().quantity, quantity); assert.equal(f.row().tactilePosition, f.master.tactilePosition); assert.equal(f.row().frankenTop, f.master.frankenTop) }
  else assert.equal(f.writes.length, 0)
  assert.ok(f.masterWrites.every(data => !('quantity' in data)))
})

test('real label route selects quantity and renderer prints zero but not unknown', async () => {
  const f = fixture(); f.row().quantity = 0
  let select: any
  f.db.switch.findFirst = async (query: any) => { select = query.select; return f.row() }
  const r = await route('src/app/api/switches/[id]/label/route.ts', f.db)
  const res = await r.GET(new Request('http://localhost/api/switches/owned/label'), params)
  assert.equal(res.status, 200); assert.equal(select.quantity, true)
  const html = await res.text(); assert.match(html, /Quantity/)
  assert.match(renderSwitchLabel({ name: 'Zero', quantity: 0 }), /Quantity<\/[^>]+>\s*<[^>]+>0</)
  assert.doesNotMatch(renderSwitchLabel({ name: 'Unknown', quantity: null }), /Quantity/)
})

for (const scenario of ['foreign-path', 'shared-url', 'master-owned', 'linked', 'own-upload']) test(`image delete respects ${scenario} reference ownership`, async () => {
  let fileDeletes = 0, detached = 0, removed = 0
  const image = { id: 'image', switchId: 'owned', url: scenario === 'foreign-path' ? '/uploads/switches/foreign/photo.jpg' : '/uploads/switches/owned/photo.jpg', type: scenario === 'linked' ? 'LINKED' : 'UPLOADED', masterSwitchId: scenario === 'master-owned' ? 'master' : null, switch: { primaryImageId: 'image', imageUrl: null } }
  const db = { switchImage: { findFirst: async () => image, count: async () => scenario === 'shared-url' ? 1 : 0, update: async () => { detached++ }, delete: async () => { removed++ }, findMany: async (query: any) => query.select && scenario === 'shared-url' ? [{ url: image.url }] : [] }, switch: { count: async () => 0, findMany: async () => [], update: async () => ({}) }, masterSwitch: { count: async () => 0, findMany: async () => [] } }
  const r = await route('src/app/api/switches/[id]/images/route.ts', db, { '@/lib/local-storage': { deleteFile: async () => { fileDeletes++ } } })
  const res = await r.DELETE(new Request('http://localhost/api/switches/owned/images?imageId=image', { method: 'DELETE' }), params)
  assert.equal(res.status, 200)
  assert.equal(fileDeletes, scenario === 'own-upload' ? 1 : 0)
  assert.equal(detached, scenario === 'master-owned' ? 1 : 0)
  assert.equal(removed, scenario === 'master-owned' ? 0 : 1)
})


test('explicit create choice never becomes overwrite when another duplicate is removed', () => {
  const owned = [{ id: 'a', name: 'Same' }]
  const row = { id: 'a', name: 'Same', overwrite: true, importAction: 'create' as const }
  assert.equal(resolveImportIdentities([row, { id: 'a', name: 'Same' }], owned)[0].existingId, undefined)
  assert.equal(resolveImportIdentities([row], owned)[0].existingId, undefined)
  assert.equal(resolveImportIdentities([row], owned)[0].overwrite, true)
})

test('catalog-to-form copy preserves all specs including null clears, long notes, zero and Franken parts', () => {
  const f = fixture()
  const master = { ...f.master, tactilePosition: 0, notes: 'x'.repeat(5001), frankenTop: 'custom', type: null, actuationForce: null, quantity: 88, personalNotes: 'never copy' }
  const form = masterFieldsToForm(master)
  assert.equal(form.tactilePosition, 0); assert.equal(form.notes, master.notes); assert.equal(form.frankenTop, 'custom')
  assert.equal(form.type, ''); assert.ok(Number.isNaN(form.actuationForce))
  assert.equal('quantity' in form, false); assert.equal('personalNotes' in form, false)
  assert.deepEqual(Object.keys(form).sort(), [...MASTER_TRACKED_FIELDS].sort())
})


test('native linked null source version survives create and bulk refuses image payloads explicitly', async () => {
  const f = fixture(true), create = await route('src/app/api/switches/route.ts', f.db)
  assert.equal((await create.POST(req({ name: 'Same', masterSwitchId: 'master', masterSwitchVersion: null, imageReferences: [] }, 'POST'))).status, 200)
  assert.equal(f.row().masterSwitchVersion, null)
  const bulk = await route('src/app/api/switches/bulk/route.ts', f.db)
  assert.equal((await bulk.PUT(req({ switches: [{ id: 'owned', imageReferences: [] }] }))).status, 400)
  assert.equal((await bulk.POST(req({ switches: [{ name: 'X', imageUrl: '/uploads/a.jpg' }] }, 'POST'))).status, 400)
})

test('primary survives equal URLs and equal display orders independent of returned row ordering', async () => {
  const f = fixture(), create = await route('src/app/api/switches/route.ts', f.db)
  const insert = f.db.switch.create
  f.db.switch.create = async (args: any) => { const row = await insert(args); row.images.reverse(); return row }
  const images = [{ ...gallery[0], primary: false, caption: 'first' }, { ...gallery[0], primary: true, caption: 'second' }]
  assert.equal((await create.POST(req({ name: 'Same', imageReferences: images }, 'POST'))).status, 200)
  assert.equal(f.row().images.find((image: any) => image.id === f.row().primaryImageId).caption, 'second')
})

// Already accepted references must remain safe; tightening import validation
// alone cannot protect aliases stored before this repair.
for (const owner of ['gallery', 'legacy', 'master', 'own-legacy']) {
  for (const alias of [
    '/uploads/switches/owned//photo.jpg',
    'http://localhost/uploads/switches/owned/photo.jpg',
    'http://localhost/uploads//switches/owned//photo.jpg?size=original#photo',
    'http://localhost/uploads/switches/owned/%70hoto.jpg',
    'http://localhost/uploads/switches/owned/sub/../photo.jpg',
    '//localhost/uploads/switches/owned/photo.jpg',
    // Host aliases / reverse proxies cannot be ruled out at cleanup time.
    'https://media.example.com/uploads/switches/owned/photo.jpg',
  ]) test(`image cleanup retains ${owner} alias ${alias}`, async () => {
    const fileDeletes: string[] = []
    let removed = 0
    const image = { id: 'image', url: '/uploads/switches/owned/photo.jpg', type: 'UPLOADED', masterSwitchId: null,
      switch: { primaryImageId: null, imageUrl: owner === 'own-legacy' ? alias : null } }
    const db = {
      switchImage: { findFirst: async () => image, count: async () => 0,
        findMany: async () => owner === 'gallery' ? [{ url: alias }] : [], delete: async () => { removed++ } },
      switch: { count: async () => 0, findMany: async ({ where }: any) => {
        // Model the own-row exclusion too: an alias left on this row must count.
        if (owner === 'own-legacy') return where?.id?.not === 'owned' ? [] : [{ imageUrl: alias }]
        return owner === 'legacy' ? [{ imageUrl: alias }] : []
      } },
      masterSwitch: { count: async () => 0, findMany: async () => owner === 'master' ? [{ imageUrl: alias }] : [] },
    }
    const r = await route('src/app/api/switches/[id]/images/route.ts', db, { '@/lib/local-storage': { deleteFile: async (path: string) => { fileDeletes.push(path) } } })
    assert.equal((await r.DELETE(new Request('http://localhost/api/switches/owned/images?imageId=image'), params)).status, 200)
    assert.deepEqual(fileDeletes, [])
    assert.equal(removed, 1, 'detach the owned relation without deleting shared bytes')
  })
}

for (const scenario of ['unreadable-references', 'unparseable-reference', 'distinct-file']) test(`image cleanup handles ${scenario} conservatively`, async () => {
  const fileDeletes: string[] = []
  const image = { id: 'image', url: '/uploads/switches/owned/photo.jpg', type: 'UPLOADED', masterSwitchId: null, switch: {} }
  const db = {
    switchImage: { findFirst: async () => image, count: async () => 0, findMany: async () => {
      if (scenario === 'unreadable-references') throw new Error('reference lookup unavailable')
      return [{ url: scenario === 'unparseable-reference' ? '/uploads/%invalid' : '/uploads/switches/owned/other.jpg' }]
    }, delete: async () => ({}) },
    switch: { count: async () => 0, findMany: async () => [] }, masterSwitch: { count: async () => 0, findMany: async () => [] },
  }
  const r = await route('src/app/api/switches/[id]/images/route.ts', db, { '@/lib/local-storage': { deleteFile: async (path: string) => { fileDeletes.push(path) } } })
  assert.equal((await r.DELETE(new Request('http://localhost/api/switches/owned/images?imageId=image'), params)).status, 200)
  assert.deepEqual(fileDeletes, scenario === 'distinct-file' ? ['switches/owned/photo.jpg'] : [])
})
