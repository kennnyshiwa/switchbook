import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'

const nativeRequire = createRequire(import.meta.url)
const routeBundle = build({
  entryPoints: ['src/app/api/switches/route.ts'],
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  plugins: [{ name: 'route-boundaries', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/(auth|prisma|with-rate-limit)$/ }, args => ({ path: args.path, external: true }))
    builder.onResolve({ filter: /^@\/utils\/manufacturerNormalization$/ }, args => ({ path: args.path, external: true }))
  } }]
})

async function fixture(master: any, options: { unauthenticated?: boolean, fail?: 'create' | 'primary' } = {}) {
  let saved: any = null
  let lookup: any = null
  let transactions = 0
  const db: any = {
    masterSwitch: { findUnique: async (query: any) => { lookup = query; return master } },
    switch: {
      count: async () => 0,
      create: async ({ data }: any) => {
        if (options.fail === 'create') throw new Error('image write failed')
        const { images, ...fields } = data
        saved = { id: 'collection-1', primaryImageId: null, ...fields,
          images: (images?.create || []).map((image: any, index: number) => ({ ...image, id: `copy-${index}`, switchId: 'collection-1' })) }
        return saved
      },
      update: async ({ data }: any) => {
        if (options.fail === 'primary') throw new Error('primary write failed')
        saved = { ...saved, ...data }; return saved
      }
    },
    $transaction: async (callback: any) => {
      transactions++
      const before = saved
      try { return await callback(db) } catch (error) { saved = before; throw error }
    }
  }
  const dependencies: Record<string, unknown> = {
    '@/lib/auth': { auth: async () => options.unauthenticated ? null : { user: { id: 'owner-1' } } },
    '@/lib/prisma': { prisma: db },
    '@/lib/with-rate-limit': { withSmartRateLimit: (handler: any) => handler },
    '@/utils/manufacturerNormalization': { normalizeManufacturerName: async (name: string) => name }
  }
  const mod = { exports: {} as any }
  new Function('require', 'module', 'exports', (await routeBundle).outputFiles[0].text)(
    (name: string) => dependencies[name] || nativeRequire(name), mod, mod.exports)
  return {
    post: (body: any) => mod.exports.POST(new Request('http://localhost/api/switches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
    })),
    state: () => ({ saved, lookup, transactions })
  }
}
const payload = { name: 'Crystal Jade', masterSwitchId: 'master-1', personalNotes: 'Keep my notes' }
const image = { id: 'master-image', masterSwitchId: 'master-1', url: 'https://example.com/jade.jpg', type: 'LINKED', order: 3, caption: 'Side view', width: 600, height: 400, size: 1234 }
const master = { status: 'APPROVED', version: 4, imageUrl: 'https://example.com/legacy.jpg', images: [image, { ...image, id: 'master-image-2', url: 'https://example.com/top.jpg', order: 8 }] }

test('dashboard master match returns copied gallery images and a collection-owned primary image', async () => {
  const f = await fixture(master)
  const response = await f.post(payload)
  assert.equal(response.status, 200)
  const result = await response.json()
  assert.equal(result.images.length, 2)
  assert.deepEqual(result.images.map((item: any) => item.url), master.images.map(item => item.url))
  assert.deepEqual(result.images.map((item: any) => item.order), [0, 1])
  assert.equal(result.primaryImageId, 'copy-0')
  assert.equal(result.images[0].masterSwitchId, undefined)
  for (const field of ['caption', 'type', 'width', 'height', 'size']) assert.equal(result.images[0][field], (image as any)[field])
  assert.equal(result.masterSwitchId, payload.masterSwitchId)
  assert.equal(result.masterSwitchVersion, 4)
  assert.equal(result.personalNotes, payload.personalNotes)
  assert.equal(result.name, payload.name)
  assert.equal(result.userId, 'owner-1')
  assert.equal(f.state().transactions, 1)
  assert.deepEqual(f.state().lookup.select.images.orderBy, { order: 'asc' })
})

test('legacy master imageUrl is copied when there is no gallery', async () => {
  const f = await fixture({ ...master, images: [] })
  const response = await f.post(payload)
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.equal(result.images.length, 1)
  assert.equal(result.images[0].url, master.imageUrl)
  assert.equal(result.images[0].type, 'LINKED')
  assert.equal(result.primaryImageId, result.images[0].id)
})

test('masters without images still create normally', async () => {
  const f = await fixture({ ...master, images: [], imageUrl: null })
  const response = await f.post(payload)
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(result.images, [])
  assert.equal(result.primaryImageId, null)
})

test('manual switch creation does not look up or inherit master images', async () => {
  const f = await fixture(master)
  const response = await f.post({ name: 'My custom switch' })
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).images, [])
  assert.equal(f.state().lookup, null)
  assert.equal(f.state().transactions, 0)
})

for (const invalid of [null, { ...master, status: 'PENDING' }]) {
  test(`missing/unapproved master is rejected: ${invalid?.status || 'missing'}`, async () => {
    const f = await fixture(invalid)
    assert.equal((await f.post(payload)).status, 400)
    assert.equal(f.state().saved, null)
  })
}
for (const fail of ['create', 'primary'] as const) {
  test(`failure during ${fail} rolls back the whole collection entry`, async () => {
    const f = await fixture(master, { fail })
    assert.equal((await f.post(payload)).status, 500)
    assert.equal(f.state().saved, null)
    assert.equal(f.state().transactions, 1)
  })
}
test('unauthenticated add remains unauthorized', async () => {
  const f = await fixture(master, { unauthenticated: true })
  assert.equal((await f.post(payload)).status, 401)
  assert.equal(f.state().saved, null)
  assert.equal(f.state().lookup, null)
})


test('explicit manual photos skip inheritance without losing the master link', async () => {
  const f = await fixture(master)
  const response = await f.post({ ...payload, copyMasterImages: false })
  const result = await response.json()
  assert.equal(response.status, 200)
  assert.deepEqual(result.images, [])
  assert.equal(result.primaryImageId, null)
  assert.equal(result.masterSwitchId, payload.masterSwitchId)
  assert.equal(result.copyMasterImages, undefined)
})
