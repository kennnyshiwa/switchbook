import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'

const nativeRequire = createRequire(import.meta.url)
const bundle = (entry: string) => build({
  entryPoints: [entry],
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  plugins: [{ name: 'route-boundaries', setup(builder) {
    builder.onResolve({ filter: /^@\/lib\/(auth|prisma|email|remote-image)$/ }, args => ({ path: args.path, external: true }))
  } }]
})
const submitBundle = bundle('src/app/api/master-switches/submit/route.ts')
const syncBundle = bundle('src/app/api/switches/[id]/sync-master/route.ts')

const REHOSTED = 'https://cdn.switchbook.app/master-switches/m-1/rehosted.jpg'

// In-memory SwitchImage rows shared between a user switch and a master switch,
// mirroring how submission attaches the user's gallery to the new master.
function database(sourceImages: any[], options: { rehostFails?: boolean } = {}) {
  const images = sourceImages.map(image => ({ masterSwitchId: null, ...image }))
  const master: any = { id: 'm-1', imageUrl: null, primaryImageId: null, version: 1 }
  const userSwitch: any = { id: 'sw-1', userId: 'owner-1', masterSwitchId: null, primaryImageId: images[0]?.id ?? null }
  let rehosts = 0
  const imagesFor = (switchId: string) => images.filter(image => image.switchId === switchId).sort((a, b) => a.order - b.order)
  const db: any = {
    masterSwitch: {
      findFirst: async () => null,
      findMany: async () => [],
      create: async ({ data }: any) => { Object.assign(master, data); return { id: master.id, name: data.name, manufacturer: data.manufacturer, status: 'PENDING' } },
      update: async ({ data }: any) => Object.assign(master, data)
    },
    user: { findUnique: async () => ({ username: 'owner' }), findMany: async () => [] },
    switch: {
      findFirst: async ({ where, include }: any) => {
        if (where.id !== userSwitch.id || where.userId !== userSwitch.userId) return null
        return { ...userSwitch, ...(include?.images ? { images: imagesFor(userSwitch.id) } : {}), ...(include?.masterSwitch ? { masterSwitch: master } : {}) }
      },
      findUnique: async () => ({ primaryImageId: userSwitch.primaryImageId }),
      update: async ({ data, include }: any) => {
        Object.assign(userSwitch, data)
        return { ...userSwitch, ...(include?.images ? { images: imagesFor(userSwitch.id) } : {}) }
      }
    },
    switchImage: {
      create: async ({ data }: any) => { const row = { id: `img-${images.length + 1}`, switchId: null, masterSwitchId: null, ...data }; images.push(row); return row },
      update: async ({ where, data }: any) => Object.assign(images.find(image => image.id === where.id), data),
      findFirst: async ({ where }: any) => images.find(image => Object.entries(where).every(([key, value]) => image[key] === value)) || null
    }
  }
  const dependencies: Record<string, unknown> = {
    '@/lib/auth': { auth: async () => ({ user: { id: 'owner-1' } }) },
    '@/lib/prisma': { prisma: db },
    '@/lib/email': { sendAdminNewSubmissionEmail: async () => {} },
    '@/lib/remote-image': { rehostRemoteImage: async () => { rehosts++; if (options.rehostFails) throw new Error('host down'); return { url: REHOSTED, width: 10, height: 10, size: 100 } } }
  }
  const load = async (built: typeof submitBundle) => {
    const mod = { exports: {} as any }
    new Function('require', 'module', 'exports', (await built).outputFiles[0].text)(
      (name: string) => dependencies[name] || nativeRequire(name), mod, mod.exports)
    return mod.exports
  }
  return { images, master, userSwitch, imagesFor, rehosts: () => rehosts, load }
}

const submission = (imageUrl: string | null) => ({
  name: 'WS Flux Diamond Teal Dream', manufacturer: 'WS', type: 'LINEAR', technology: 'MAGNETIC',
  confirmNotDuplicate: true, submissionNotes: 'From my collection', sourceSwitchId: 'sw-1', imageUrl
})

async function submitThenSync(db: ReturnType<typeof database>, imageUrl: string | null) {
  const submit = await db.load(submitBundle)
  const response = await submit.POST(new Request('http://localhost/api/master-switches/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(submission(imageUrl))
  }))
  assert.equal(response.status, 200, JSON.stringify(await response.clone().json()))
  // EditSwitchModal syncs immediately after a linked submission
  const sync = await db.load(syncBundle)
  const synced = await sync.POST(new Request('http://localhost/api/switches/sw-1/sync-master', { method: 'POST' }), { params: Promise.resolve({ id: 'sw-1' }) })
  assert.equal(synced.status, 200)
}

const external = 'https://example.com/teal-dream.jpg'
const gallery = () => [
  { id: 'u-1', switchId: 'sw-1', url: external, type: 'LINKED', order: 0 },
  { id: 'u-2', switchId: 'sw-1', url: 'https://example.com/side.jpg', type: 'LINKED', order: 1 }
]
const masterUrls = (db: ReturnType<typeof database>) =>
  db.images.filter(image => image.masterSwitchId === 'm-1').sort((a, b) => a.order - b.order).map(image => image.url)

test('submitting a switch whose first image is external does not duplicate that image', async () => {
  const db = database(gallery())
  await submitThenSync(db, external)
  assert.deepEqual(db.imagesFor('sw-1').map(image => image.url), [external, 'https://example.com/side.jpg'])
  // The master keeps its own hosted copy instead of also sharing the original
  assert.equal(db.rehosts(), 1)
  assert.deepEqual(masterUrls(db), [REHOSTED, 'https://example.com/side.jpg'])
  assert.equal(db.master.imageUrl, REHOSTED)
  assert.equal(db.images.find(image => image.id === 'u-1').masterSwitchId, null)
})

test('when rehosting fails the shared original becomes the master primary', async () => {
  const db = database(gallery(), { rehostFails: true })
  await submitThenSync(db, external)
  assert.deepEqual(db.imagesFor('sw-1').map(image => image.url), [external, 'https://example.com/side.jpg'])
  assert.deepEqual(masterUrls(db), [external, 'https://example.com/side.jpg'])
  assert.equal(db.master.primaryImageId, 'u-1')
  assert.equal(db.master.imageUrl, external)
})

test('syncing never prepends the master image to a switch that already has photos', async () => {
  const db = database([{ id: 'u-1', switchId: 'sw-1', url: 'https://example.com/mine.jpg', type: 'UPLOADED', order: 0 }])
  db.userSwitch.masterSwitchId = 'm-1'
  db.master.imageUrl = REHOSTED
  const sync = await db.load(syncBundle)
  const synced = await sync.POST(new Request('http://localhost/api/switches/sw-1/sync-master', { method: 'POST' }), { params: Promise.resolve({ id: 'sw-1' }) })
  assert.equal(synced.status, 200)
  assert.deepEqual(db.imagesFor('sw-1').map(image => image.url), ['https://example.com/mine.jpg'])
})

test('an image-less submission still rehosts its URL and syncs it back once', async () => {
  const db = database([])
  await submitThenSync(db, 'https://example.com/only.jpg')
  assert.equal(db.rehosts(), 1)
  assert.equal(db.master.imageUrl, REHOSTED)
  assert.deepEqual(db.imagesFor('sw-1').map(image => image.url), [REHOSTED])
})

test('the rehosted copy keeps the original image position in the master gallery', async () => {
  const db = database([
    { id: 'u-0', switchId: 'sw-1', url: 'https://cdn.switchbook.app/mine.jpg', type: 'UPLOADED', order: 0 },
    { id: 'u-1', switchId: 'sw-1', url: external, type: 'LINKED', order: 1 },
    { id: 'u-2', switchId: 'sw-1', url: 'https://example.com/side.jpg', type: 'LINKED', order: 2 }
  ])
  await submitThenSync(db, external)
  assert.deepEqual(
    db.images.filter(image => image.masterSwitchId === 'm-1').map(image => image.order).sort(),
    [0, 1, 2]
  )
  assert.deepEqual(masterUrls(db), ['https://cdn.switchbook.app/mine.jpg', REHOSTED, 'https://example.com/side.jpg'])
})
