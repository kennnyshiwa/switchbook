import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { switchSchema, SWITCH_NOTES_MAX, SWITCH_PERSONAL_NOTES_MAX, parseQuantityInput } from '../src/lib/validation'
import { transformSwitchData } from '../src/utils/dataTransform'
import { serializeCanonicalSwitchShare } from '../src/lib/canonical-switch-share'
import { applySwitchFilters, deriveSwitchFilterOptions } from '../src/lib/switch-filters'

const nativeRequire = createRequire(import.meta.url)
const bundle = (entry: string) => build({
  entryPoints: [entry],
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  plugins: [{ name: 'route-boundaries', setup(builder) {
    builder.onResolve({ filter: /^@\/(lib\/(auth|prisma|email|remote-image|with-rate-limit|performance-monitor)|utils\/manufacturerNormalization)$/ }, args => ({ path: args.path, external: true }))
  } }]
})
const routes = {
  update: bundle('src/app/api/switches/[id]/route.ts'),
  bulk: bundle('src/app/api/switches/bulk/route.ts'),
  submit: bundle('src/app/api/master-switches/submit/route.ts'),
  sync: bundle('src/app/api/switches/[id]/sync-master/route.ts'),
  syncAll: bundle('src/app/api/switches/sync-all-master/route.ts'),
  link: bundle('src/app/api/master-switches/[id]/link-existing/route.ts'),
  updateNotes: bundle('src/app/api/switches/[id]/update-notes/route.ts'),
}

async function load(built: ReturnType<typeof bundle>, prisma: unknown) {
  const dependencies: Record<string, unknown> = {
    '@/lib/auth': { auth: async () => ({ user: { id: 'owner-1' } }) },
    '@/lib/prisma': { prisma },
    '@/lib/email': { sendAdminNewSubmissionEmail: async () => {} },
    '@/lib/remote-image': { rehostRemoteImage: async () => { throw new Error('offline') } },
    '@/lib/with-rate-limit': { withSmartRateLimit: (handler: unknown) => handler },
    '@/lib/performance-monitor': { BulkOperationMonitor: class { addError() {} complete() { return { duration: 1 } } } },
    '@/utils/manufacturerNormalization': { normalizeManufacturerName: async (name: string) => name },
  }
  const mod = { exports: {} as any }
  // The bulk route schedules a module-level interval; don't let it hold the test process open.
  new Function('require', 'module', 'exports', 'setInterval', (await built).outputFiles[0].text)(
    (name: string) => dependencies[name] || nativeRequire(name), mod, mod.exports, () => 0)
  return mod.exports
}

const json = (url: string, method: string, body: unknown) => new Request(url, {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
})

const MASTER = {
  id: 'm-1', status: 'APPROVED', version: 4, name: 'Master Name', chineseName: null, type: 'LINEAR', technology: 'MECHANICAL',
  manufacturer: 'Acme', notes: 'Master notes', imageUrl: null, images: [], lastModifiedAt: new Date(),
  progressiveSpring: false, doubleStage: false,
}

// One user switch row plus every write the routes make, so tests can assert
// on both the final row and what was sent to MasterSwitch.
function database(overrides: Record<string, unknown> = {}) {
  const row: any = {
    id: 'sw-1', userId: 'owner-1', name: 'Mine', manufacturer: 'Acme', masterSwitchId: null, masterSwitchVersion: null,
    notes: 'Old notes', personalNotes: 'Keep me', personalTags: ['keep'], quantity: 42, images: [], primaryImageId: null,
    ...overrides,
  }
  const masterWrites: any[] = []
  const switchWrites: any[] = []
  const withMaster = () => ({ ...row, masterSwitch: row.masterSwitchId ? MASTER : null })
  const prisma: any = {
    switch: {
      findFirst: async ({ where }: any) => (where.id === row.id && where.userId === row.userId ? withMaster() : null),
      findUnique: async ({ where }: any) => (where.id === row.id ? withMaster() : null),
      findMany: async () => [withMaster()],
      // Prisma treats `undefined` as "leave this column alone".
      update: async ({ data }: any) => {
        switchWrites.push(data)
        Object.assign(row, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined)))
        return { ...row }
      },
    },
    masterSwitch: {
      findUnique: async () => MASTER,
      findFirst: async () => null,
      findMany: async () => [],
      create: async ({ data }: any) => { masterWrites.push(data); return { id: 'm-new', name: data.name, manufacturer: data.manufacturer, status: 'PENDING' } },
      update: async ({ data }: any) => { masterWrites.push(data); return {} },
    },
    switchImage: { findFirst: async () => null, create: async ({ data }: any) => ({ id: 'img-1', ...data }), update: async () => ({}) },
    user: { findUnique: async () => ({ username: 'owner' }), findMany: async () => [] },
    $transaction: async (fn: any) => (typeof fn === 'function' ? fn(prisma) : Promise.all(fn)),
  }
  return { row, prisma, masterWrites, switchWrites }
}

const assertUserFieldsKept = (row: any) => {
  assert.equal(row.quantity, 42)
  assert.deepEqual(row.personalTags, ['keep'])
}

test('switchSchema accepts optional non-negative integer quantities and normalizes blanks to null', () => {
  const parse = (quantity: unknown) => switchSchema.safeParse({ name: 'x', quantity })
  assert.equal(parse(5).data?.quantity, 5)
  assert.equal(parse(0).data?.quantity, 0)
  assert.equal(parse('12').data?.quantity, 12)
  assert.equal(parse('').data?.quantity, null)
  assert.equal(parse('  ').data?.quantity, null)
  assert.equal(parse(NaN).data?.quantity, null)
  assert.equal(parse(null).data?.quantity, null)
  assert.equal('quantity' in (switchSchema.parse({ name: 'x' })), false)
  for (const bad of [-1, 1.5, '2.5', 'abc', true, 10_000_000]) assert.equal(parse(bad).success, false, String(bad))
})

test('transformSwitchData leaves absent quantity/personalNotes/personalTags untouched but writes explicit values', () => {
  const absent = transformSwitchData({ name: 'x' })
  assert.equal(absent.quantity, undefined)
  assert.equal(absent.personalNotes, undefined)
  assert.equal(absent.personalTags, undefined)
  assert.equal('personalTags' in switchSchema.parse({ name: 'x' }), false, 'no default [] that would wipe tags')
  assert.deepEqual(transformSwitchData({ name: 'x', personalTags: [] }).personalTags, [])
  assert.equal(transformSwitchData({ name: 'x', quantity: null }).quantity, null)
  assert.equal(transformSwitchData({ name: 'x', quantity: 0 }).quantity, 0)
  assert.equal(transformSwitchData({ name: 'x', personalNotes: '' }).personalNotes, null)
})

test('numeric fields keep 0 while blank/NaN/undefined become null', () => {
  const zeros = transformSwitchData({ name: 'x', actuationForce: 0, tactilePosition: 0, preTravel: 0, bottomOut: 0, initialForce: 0, initialMagneticFlux: 0, bottomOutMagneticFlux: 0, tactileForce: 0, bottomOutForce: 0 })
  for (const key of ['actuationForce', 'tactilePosition', 'preTravel', 'bottomOut', 'initialForce', 'initialMagneticFlux', 'bottomOutMagneticFlux', 'tactileForce', 'bottomOutForce'] as const) {
    assert.equal(zeros[key], 0, key)
  }
  // What the forms send for an empty number input (valueAsNumber -> NaN).
  const blank = transformSwitchData(switchSchema.parse({ name: 'x', actuationForce: NaN, preTravel: NaN }))
  assert.equal(blank.actuationForce, null)
  assert.equal(blank.preTravel, null)
  assert.equal(transformSwitchData({ name: 'x', bottomOut: NaN }).bottomOut, null)
  assert.equal(transformSwitchData({ name: 'x' }).tactilePosition, null)
})

test('notes allow 2000 characters and personal notes 5000', () => {
  assert.equal(SWITCH_NOTES_MAX, 2000)
  assert.equal(SWITCH_PERSONAL_NOTES_MAX, 5000)
  for (const [key, max] of [['notes', SWITCH_NOTES_MAX], ['personalNotes', SWITCH_PERSONAL_NOTES_MAX]] as const) {
    assert.equal(switchSchema.safeParse({ name: 'x', [key]: 'n'.repeat(max) }).success, true, key)
    assert.equal(switchSchema.safeParse({ name: 'x', [key]: 'n'.repeat(max + 1) }).success, false, key)
  }
})

test('update-notes rejects (without writing) merged personal notes over the cap instead of truncating', async () => {
  const db = database()
  const route = await load(routes.updateNotes, db.prisma)
  const params = { params: Promise.resolve({ id: 'sw-1' }) }
  const tooLong = 'p'.repeat(SWITCH_PERSONAL_NOTES_MAX + 1)
  let res = await route.PATCH(json('http://localhost/api/switches/sw-1/update-notes', 'PATCH', { notes: '', personalNotes: tooLong }), params)
  assert.equal(res.status, 400)
  assert.match((await res.json()).error, /shorten/)
  assert.equal(db.switchWrites.length, 0)
  assert.equal(db.row.personalNotes, 'Keep me')
  const merged = 'p'.repeat(SWITCH_PERSONAL_NOTES_MAX)
  res = await route.PATCH(json('http://localhost/api/switches/sw-1/update-notes', 'PATCH', { notes: '', personalNotes: merged }), params)
  assert.equal(res.status, 200)
  assert.equal(db.row.personalNotes, merged, 'stored in full, never truncated')
})

test('parseQuantityInput accepts whole numbers (incl. "1.0") and rejects the rest', () => {
  assert.deepEqual(parseQuantityInput(''), { ok: true, value: null })
  assert.deepEqual(parseQuantityInput(' 7 '), { ok: true, value: 7 })
  assert.deepEqual(parseQuantityInput('1.0'), { ok: true, value: 1 })
  assert.deepEqual(parseQuantityInput('0'), { ok: true, value: 0 })
  for (const bad of ['-1', '2.5', '1,000', 'abc', '1e3', '1000001']) assert.equal(parseQuantityInput(bad).ok, false, bad)
})

test('PUT /api/switches/[id] saves quantity and preserves it when a client omits it', async () => {
  const db = database()
  const route = await load(routes.update, db.prisma)
  const params = { params: Promise.resolve({ id: 'sw-1' }) }
  let res = await route.PUT(json('http://localhost/api/switches/sw-1', 'PUT', { name: 'Mine' }), params)
  assert.equal(res.status, 200)
  assert.equal(db.row.quantity, 42)
  assert.equal(db.row.personalNotes, 'Keep me')
  assert.deepEqual(db.row.personalTags, ['keep'], 'absent personalTags are left unchanged')
  res = await route.PUT(json('http://localhost/api/switches/sw-1', 'PUT', { name: 'Mine', personalTags: [], personalNotes: '' }), params)
  assert.deepEqual(db.row.personalTags, [])
  assert.equal(db.row.personalNotes, null)
  res = await route.PUT(json('http://localhost/api/switches/sw-1', 'PUT', { name: 'Mine', quantity: 7 }), params)
  assert.equal(db.row.quantity, 7)
  res = await route.PUT(json('http://localhost/api/switches/sw-1', 'PUT', { name: 'Mine', quantity: '' }), params)
  assert.equal(db.row.quantity, null)
  res = await route.PUT(json('http://localhost/api/switches/sw-1', 'PUT', { name: 'Mine', quantity: -3 }), params)
  assert.equal(res.status, 400)
})

test('bulk edit keeps personal notes and saves quantity', async () => {
  const db = database()
  const route = await load(routes.bulk, db.prisma)
  const res = await route.PUT(json('http://localhost/api/switches/bulk', 'PUT', {
    switches: [{ id: 'sw-1', name: 'Renamed', personalTags: ['keep'], quantity: 9, dateObtained: '' }],
  }))
  assert.equal(res.status, 200)
  assert.equal((await res.json()).results.success, 1)
  assert.equal(db.row.name, 'Renamed')
  assert.equal(db.row.quantity, 9)
  assert.equal(db.row.personalNotes, 'Keep me', 'bulk edit grid does not send personalNotes; it must survive')
})

test('master submission never copies quantity or personal fields into the master switch', async () => {
  const db = database()
  const route = await load(routes.submit, db.prisma)
  const res = await route.POST(json('http://localhost/api/master-switches/submit', 'POST', {
    name: 'Mine', manufacturer: 'Acme', submissionNotes: 'A unique switch from my collection',
    confirmNotDuplicate: true, sourceSwitchId: 'sw-1', imageUrl: null,
    quantity: 42, personalNotes: 'Keep me', personalTags: ['keep'],
  }))
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()))
  assert.ok(db.masterWrites.length > 0)
  for (const write of db.masterWrites) {
    for (const key of ['quantity', 'personalNotes', 'personalTags']) {
      assert.equal(key in write, false, `MasterSwitch write has ${key}`)
      if (write.originalSubmissionData) assert.equal(key in write.originalSubmissionData, false, `originalSubmissionData has ${key}`)
    }
  }
  assert.equal(db.row.masterSwitchId, 'm-new')
  assertUserFieldsKept(db.row)
  assert.equal(db.row.personalNotes, 'Keep me')
})

test('linking, syncing and sync-all preserve quantity on the user switch', async () => {
  const linkDb = database()
  const link = await load(routes.link, linkDb.prisma)
  let res = await link.POST(json('http://localhost/api/master-switches/m-1/link-existing', 'POST', { userSwitchId: 'sw-1' }), { params: Promise.resolve({ id: 'm-1' }) })
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()))
  assert.equal(linkDb.row.masterSwitchId, 'm-1')
  assert.equal(linkDb.row.notes, 'Master notes')
  assertUserFieldsKept(linkDb.row)
  assert.match(linkDb.row.personalNotes, /Keep me/)

  // Merging long notes into personal notes is kept in full while it fits...
  const fitDb = database({ notes: 'o'.repeat(2000), personalNotes: 'p'.repeat(2500) })
  res = await (await load(routes.link, fitDb.prisma)).POST(json('http://localhost/api/master-switches/m-1/link-existing', 'POST', { userSwitchId: 'sw-1' }), { params: Promise.resolve({ id: 'm-1' }) })
  assert.equal(res.status, 200)
  assert.equal(fitDb.row.personalNotes, `${'p'.repeat(2500)}\n\nPrevious notes: ${'o'.repeat(2000)}`)
  assert.equal(switchSchema.safeParse({ name: 'x', personalNotes: fitDb.row.personalNotes }).success, true)

  // ...and refused (no write, nothing truncated) when it would exceed the cap.
  const longDb = database({ notes: 'o'.repeat(2000), personalNotes: 'p'.repeat(4000) })
  res = await (await load(routes.link, longDb.prisma)).POST(json('http://localhost/api/master-switches/m-1/link-existing', 'POST', { userSwitchId: 'sw-1' }), { params: Promise.resolve({ id: 'm-1' }) })
  assert.equal(res.status, 400)
  assert.match((await res.json()).error, /shorten/)
  assert.equal(longDb.switchWrites.length, 0)
  assert.equal(longDb.row.masterSwitchId, null)
  assert.equal(longDb.row.personalNotes, 'p'.repeat(4000))
  assert.equal(longDb.row.notes, 'o'.repeat(2000))

  const syncDb = database({ masterSwitchId: 'm-1', masterSwitchVersion: 1 })
  const sync = await load(routes.sync, syncDb.prisma)
  res = await sync.POST(new Request('http://localhost/api/switches/sw-1/sync-master', { method: 'POST' }), { params: Promise.resolve({ id: 'sw-1' }) })
  assert.equal(res.status, 200)
  assertUserFieldsKept(syncDb.row)
  assert.equal(syncDb.row.personalNotes, 'Keep me')

  const allDb = database({ masterSwitchId: 'm-1', masterSwitchVersion: 1 })
  const syncAll = await load(routes.syncAll, allDb.prisma)
  res = await syncAll.POST(new Request('http://localhost/api/switches/sync-all-master', { method: 'POST' }))
  assert.equal(res.status, 200)
  assertUserFieldsKept(allDb.row)
  assert.equal(allDb.row.personalNotes, 'Keep me')
  assert.ok(linkDb.switchWrites.length && syncDb.switchWrites.length && allDb.switchWrites.length, 'each flow wrote the user switch')
  assert.equal(allDb.row.masterSwitchVersion, 4)
  for (const write of [...linkDb.switchWrites, ...syncDb.switchWrites, ...allDb.switchWrites]) {
    assert.equal('quantity' in write, false, 'master sync must not write quantity')
  }
})

test('user share pages show quantity (including zero) in personal details; master shares never do', () => {
  const user = serializeCanonicalSwitchShare('user', { name: 'Jade', quantity: 0 })
  assert.deepEqual(user.personalSections[0].stats, [{ key: 'quantity', label: 'Quantity', value: '0' }])
  assert.equal(serializeCanonicalSwitchShare('user', { name: 'Jade', quantity: null }).personalSections.length, 0)
  assert.equal(serializeCanonicalSwitchShare('master', { name: 'Jade', quantity: 3 }).personalSections.length, 0)
})

test('PUT on a linked switch marks fields that differ from the master (shared helper)', async () => {
  const db = database({ masterSwitchId: 'm-1' })
  const route = await load(routes.update, db.prisma)
  const res = await route.PUT(json('http://localhost/api/switches/sw-1', 'PUT', { name: MASTER.name, type: MASTER.type, technology: MASTER.technology, manufacturer: MASTER.manufacturer, notes: 'My own notes' }), { params: Promise.resolve({ id: 'sw-1' }) })
  assert.equal(res.status, 200)
  assert.equal(db.row.isModified, true)
  assert.deepEqual(db.row.modifiedFields, ['notes'])
})

test('collection filters support quantity ranges', () => {
  const records = [{ quantity: 0 }, { quantity: 10 }, { quantity: null }, { quantity: 70 }]
  assert.deepEqual(deriveSwitchFilterOptions(records).quantities, [0, 10, 70])
  assert.deepEqual(applySwitchFilters(records, { quantityMin: 5, quantityMax: 70 }), [records[1], records[3]])
  assert.deepEqual(applySwitchFilters(records, { quantityMax: 0 }), [records[0]])
})
