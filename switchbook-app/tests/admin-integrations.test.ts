import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { AdminIntegrationStore, isCatalogOnlyApplication, publicCredential } from '../src/lib/admin-integrations'
import { applicationCredentialIsUsable } from '../src/lib/partner-api/auth'

const root = new URL('../', import.meta.url)

function fakeDb() {
  const applications: any[] = []
  const credentials: any[] = []
  const audits: any[] = []
  let serial = 0
  const tx: any = {
    $executeRaw: async () => 1,
    partnerApplication: {
      findFirst: async ({ where }: any) => applications.find(app => app.name.toLowerCase() === where.name.equals.toLowerCase()) || null,
      findUnique: async ({ where }: any) => applications.find(app => app.id === where.id || app.clientId === where.clientId) || null,
      create: async ({ data }: any) => { const now = new Date(); const row = { id: `app-${++serial}`, createdAt: now, updatedAt: now, ...data }; applications.push(row); return row },
    },
    partnerCredential: {
      create: async ({ data }: any) => { const row = { id: `key-${++serial}`, createdAt: new Date(), revokedAt: null, lastUsedAt: null, ...data }; credentials.push(row); return row },
      findFirst: async ({ where }: any) => credentials.find(key => key.id === where.id && key.applicationId === where.applicationId) || null,
      updateMany: async ({ where, data }: any) => { const rows = credentials.filter(key => (!where.id || key.id === where.id || where.id.in?.includes(key.id)) && (!where.applicationId || key.applicationId === where.applicationId) && (where.revokedAt === undefined || key.revokedAt === where.revokedAt)); rows.forEach(row => Object.assign(row, data)); return { count: rows.length } },
    },
    partnerAuditEvent: { create: async ({ data }: any) => { audits.push(data); return data } },
  }
  return { db: { $transaction: async (callback: any) => callback(tx) } as any, applications, credentials, audits }
}

test('catalog-only classification rejects broad scopes, redirects, and webhooks', () => {
  const base = { scopes: ['catalog:read'], redirectUris: [], webhookUrl: null, webhookSecretEnvelope: null }
  assert.equal(isCatalogOnlyApplication(base), true)
  assert.equal(isCatalogOnlyApplication({ ...base, scopes: ['catalog:read', 'submissions:write'] }), false)
  assert.equal(isCatalogOnlyApplication({ ...base, redirectUris: ['https://oauth.example/callback'] }), false)
  assert.equal(isCatalogOnlyApplication({ ...base, webhookUrl: 'https://hooks.example' }), false)
})

test('metadata projection never exposes a stored hash', () => {
  const metadata = publicCredential({ id: 'key', prefix: 'sbk_123456789abc', scopes: ['catalog:read'], createdAt: new Date(0), expiresAt: null, revokedAt: null, lastUsedAt: null })
  assert.deepEqual(Object.keys(metadata).sort(), ['createdAt', 'expiresAt', 'id', 'lastUsedAt', 'prefix', 'revokedAt', 'scopes'])
  assert.doesNotMatch(JSON.stringify(metadata), /secret|hash|apiKey/i)
})

test('create persists only a hash, fixes catalog-only invariants, and returns raw key once', async () => {
  const state = fakeDb()
  const result = await new AdminIntegrationStore(state.db).create({ name: 'KeebVault', rateLimitPerMinute: 120, expiresAt: null, actorUserId: 'admin-1' })
  assert.match(result.apiKey, /^sbk_[a-f0-9]{12}\.[A-Za-z0-9_-]+$/)
  assert.deepEqual(state.applications[0].scopes, ['catalog:read'])
  assert.deepEqual(state.applications[0].redirectUris, [])
  assert.equal(state.applications[0].webhookUrl, null)
  assert.match(state.credentials[0].secretHash, /^[a-f0-9]{64}$/)
  assert.equal(JSON.stringify(state).includes(result.apiKey), false)
  assert.equal(state.audits[0].actorUserId, 'admin-1')
  assert.doesNotMatch(JSON.stringify(state.audits), /apiKey|secretHash|\.([A-Za-z0-9_-]{20,})/)
})

test('rotation supports overlap or atomic revocation and exact revoke is immediate', async () => {
  const state = fakeDb()
  const store = new AdminIntegrationStore(state.db)
  const initial = await store.create({ name: 'KeebVault', rateLimitPerMinute: 60, expiresAt: null, actorUserId: 'admin-1' })
  const overlap = await store.rotate({ applicationId: initial.application.id, revokeExisting: false, expiresAt: null, actorUserId: 'admin-2' })
  assert.equal(overlap.revokedCount, 0)
  assert.equal(state.credentials.filter(key => !key.revokedAt).length, 2)
  const replacement = await store.rotate({ applicationId: initial.application.id, revokeExisting: true, expiresAt: null, actorUserId: 'admin-2' })
  assert.equal(replacement.revokedCount, 2)
  assert.equal(state.credentials.filter(key => !key.revokedAt).length, 1)
  const revoked = await store.revoke({ applicationId: initial.application.id, credentialId: replacement.credential.id, actorUserId: 'admin-3' })
  assert.ok(revoked.revokedAt)
  assert.equal(state.credentials.filter(key => !key.revokedAt).length, 0)
  assert.equal(applicationCredentialIsUsable({ revokedAt: new Date(), expiresAt: null, application: { active: true } }), false)
  assert.deepEqual(state.audits.map(item => item.action), ['admin.catalog_key.issue', 'admin.catalog_key.rotate', 'admin.catalog_key.rotate', 'admin.catalog_key.revoke'])
})

test('admin routes enforce ADMIN and strict same-origin mutations with no-store responses', async () => {
  const helper = await readFile(new URL('src/lib/admin-integration-http.ts', root), 'utf8')
  const createRoute = await readFile(new URL('src/app/api/admin/integrations/route.ts', root), 'utf8')
  const rotateRoute = await readFile(new URL('src/app/api/admin/integrations/[id]/rotate/route.ts', root), 'utf8')
  const revokeRoute = await readFile(new URL('src/app/api/admin/integrations/[id]/credentials/[credentialId]/revoke/route.ts', root), 'utf8')
  assert.match(helper, /session\.user\.role !== 'ADMIN'/)
  assert.match(helper, /isSameOriginMutation\(request\)/)
  assert.match(helper, /'Cache-Control': 'no-store, private'/)
  for (const source of [createRoute, rotateRoute, revokeRoute]) assert.match(source, /requireIntegrationAdmin\(request\)/)
  assert.match(rotateRoute, /revokeExisting: z\.boolean\(\)/)
})

test('UI has responsive one-time reveal, loading, empty, error, copy and confirmations', async () => {
  const source = await readFile(new URL('src/components/admin/IntegrationKeyManager.tsx', root), 'utf8')
  for (const text of ['Copy this key now', 'only reveal', 'Loading integrations', 'No catalog integrations yet', 'Copy failed', 'Immediately revoke', 'overlap window']) assert.match(source, new RegExp(text, 'i'))
  assert.match(source, /navigator\.clipboard\.writeText/)
  assert.match(source, /sm:flex-row/)
  assert.match(source, /overflow-x-auto/)
  assert.match(source, /const formElement = event\.currentTarget/)
  assert.equal(source.includes('await refresh()\n      event.currentTarget'), false)
  assert.match(source, /Expired/)
  assert.match(source, /max-w-full overflow-x-auto/)
  assert.match(source, /role="region"/)
})

test('middleware anonymous API denial retains 401 security and no-store cache contract', async () => {
  const middleware = await readFile(new URL('src/middleware.ts', root), 'utf8')
  assert.match(middleware, /error: 'Unauthorized'/)
  assert.match(middleware, /status: 401/)
  assert.match(middleware, /'Cache-Control': 'no-store, private'/)
  assert.match(middleware, /Pragma: 'no-cache'/)
})

test('existing CLI and OAuth paths remain independent of admin management', async () => {
  const cli = await readFile(new URL('scripts/catalog-key.ts', root), 'utf8')
  const auth = await readFile(new URL('src/lib/partner-api/auth.ts', root), 'utf8')
  assert.match(cli, /issueCatalogKeyToFile/)
  assert.match(cli, /PrismaCatalogKeyStore/)
  assert.match(auth, /verifyUserToken/)
  assert.match(auth, /createRemoteJWKSet/)
  assert.doesNotMatch(await readFile(new URL('src/lib/admin-integrations.ts', root), 'utf8'), /hydra|sealSecret|openSecret/i)
})
