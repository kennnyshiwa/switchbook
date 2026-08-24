import assert from 'node:assert/strict'
import test from 'node:test'
import { issuePartnerKey, secureEqualHash } from '../src/lib/partner-api/crypto'
import { proposedSwitchSchema } from '../src/lib/partner-api/schemas'
import { createPinnedLookup, resolvePublicHost, validateImageUrl } from '../src/lib/image-security'
import { switchesDbSearchUrl } from '../src/lib/partner-api/config'
import { openSecret, sealSecret } from '../src/lib/partner-api/crypto'
import { catalogDisposition } from '../src/lib/partner-api/catalog'
import { missingPartnerScopes, partnerScopesFromClaims } from '../src/lib/partner-api/auth'
import { assertNoMergeCycle } from '../src/lib/partner-api/lifecycle'
import { PartnerApiError } from '../src/lib/partner-api/errors'
import { assertSafeWebhookUrl, drainLimitedResponse } from '../src/lib/partner-api/outbound'
import { cacheableJson } from '../src/lib/partner-api/http'
import { readFileSync } from 'node:fs'
import { classifyIdempotency } from '../src/lib/partner-api/idempotency'
import { createHmac } from 'node:crypto'
import SwaggerParser from '@apidevtools/swagger-parser'

test('partner keys are prefixed, random, and hash-verifiable', () => {
  const first = issuePartnerKey()
  const second = issuePartnerKey()
  assert.match(first.raw, /^sbk_[a-f0-9]{12}\.[A-Za-z0-9_-]+$/)
  assert.notEqual(first.raw, second.raw)
  assert.equal(secureEqualHash(first.raw, first.hash), true)
  assert.equal(secureEqualHash(`${first.raw}x`, first.hash), false)
})

test('proposal schema bounds input and requires photo alt text', () => {
  assert.equal(proposedSwitchSchema.safeParse({ name: 'Oil King', manufacturer: 'Gateron', submissionNotes: 'A complete source note', photos: [] }).success, true)
  assert.equal(proposedSwitchSchema.safeParse({ name: '', manufacturer: 'Gateron', submissionNotes: 'short' }).success, false)
  assert.equal(proposedSwitchSchema.safeParse({ name: 'X', manufacturer: 'Y', submissionNotes: 'A complete source note', photos: [{ url: 'https://example.com/x.png', alt: '' }] }).success, false)
})

test('image URL validation blocks local and insecure sources', () => {
  assert.equal(validateImageUrl('http://example.com/image.png').valid, false)
  assert.equal(validateImageUrl('https://127.0.0.1/image.png').valid, false)
  assert.equal(validateImageUrl('https://169.254.169.254/latest.png').valid, false)
  assert.equal(validateImageUrl('https://images.example.com/image.png').valid, true)
})

test('SwitchesDB links carry encoded manufacturer and model search', () => {
  assert.equal(switchesDbSearchUrl('Oil King', 'Gateron'), 'https://switchesdb.switchbook.app/?search=Gateron%20Oil%20King')
})

test('pending/rejected records never become visible merely by having lifecycle metadata', () => {
  const provenance = { status: 'ACTIVE', catalogApprovedAt: new Date() }
  assert.equal(catalogDisposition('PENDING', provenance), 'NOT_FOUND')
  assert.equal(catalogDisposition('REJECTED', provenance), 'NOT_FOUND')
  assert.equal(catalogDisposition('APPROVED', null), 'ACTIVE')
  assert.equal(catalogDisposition('REJECTED', { ...provenance, status: 'MERGED' }), 'MERGED')
})

test('webhook secrets are authenticated encrypted envelopes and fail under the wrong key', () => {
  process.env.PARTNER_SECRET_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
  const envelope = sealSecret('raw-shared-secret')
  assert.notEqual(envelope, 'raw-shared-secret')
  assert.equal(openSecret(envelope), 'raw-shared-secret')
  const payload = '1700000000.{"event":"submission.approved"}'
  const expected = createHmac('sha256', 'raw-shared-secret').update(payload).digest('hex')
  assert.equal(createHmac('sha256', openSecret(envelope)).update(payload).digest('hex'), expected)
  process.env.PARTNER_SECRET_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString('base64')
  assert.throws(() => openSecret(envelope))
})

test('merge invariant rejects self and indirect cycles', async () => {
  await assert.rejects(() => assertNoMergeCycle('a', 'a', async () => null), (error: unknown) => error instanceof PartnerApiError && error.code === 'lifecycle_cycle')
  const chain: Record<string, string | null> = { b: 'c', c: 'a' }
  await assert.rejects(() => assertNoMergeCycle('a', 'b', async id => chain[id] || null), (error: unknown) => error instanceof PartnerApiError && error.code === 'lifecycle_cycle')
})

test('webhook validator rejects HTTP, embedded credentials, and non-443 ports before fetch', async () => {
  await assert.rejects(() => assertSafeWebhookUrl('http://example.com/hook'))
  await assert.rejects(() => assertSafeWebhookUrl('https://user:pass@example.com/hook'))
  await assert.rejects(() => assertSafeWebhookUrl('https://example.com:8443/hook'))
  await assert.rejects(() => assertSafeWebhookUrl('https://127.0.0.1/hook'))
})

test('scope enforcement reports every missing permission', () => {
  assert.deepEqual(missingPartnerScopes(new Set(['catalog:read']), ['catalog:read', 'submissions:write', 'corrections:write']), ['submissions:write', 'corrections:write'])
})

test('conditional JSON returns 304 for matching ETag', async () => {
  const first = cacheableJson(new Request('https://switchbook.app/api/v1/catalog/switches'), { data: [] }, new Date('2026-01-01'))
  const etag = first.headers.get('etag')!
  const second = cacheableJson(new Request('https://switchbook.app/api/v1/catalog/switches', { headers: { 'if-none-match': etag } }), { data: [] }, new Date('2026-01-01'))
  assert.equal(second.status, 304)
  assert.equal(second.headers.get('etag'), etag)
})

test('conditional JSON accepts a CDN-weakened ETag and comma-separated validators', async () => {
  const initial = cacheableJson(new Request('https://switchbook.app/api/v1/catalog/switches'), { data: ['stable'] })
  const etag = initial.headers.get('etag')!
  const weak = cacheableJson(new Request('https://switchbook.app/api/v1/catalog/switches', { headers: { 'If-None-Match': `"other", W/${etag}` } }), { data: ['stable'] })
  assert.equal(weak.status, 304)
})

test('Hydra and nginx jointly mandate PKCE S256 and publish access-token keys', () => {
  const hydra = readFileSync(new URL('../ops/hydra/hydra.yml', import.meta.url), 'utf8')
  const nginx = readFileSync(new URL('../nginx/conf.d/default.conf', import.meta.url), 'utf8')
  assert.match(hydra, /pkce:\s+enforced: true/)
  assert.match(hydra, /hydra\.jwt\.access-token/)
  assert.match(nginx, /code_challenge_method != "S256"/)
  assert.match(nginx, /arg_code_challenge = ""/)
})

test('idempotency conflicts and in-flight reservations cannot replay side effects', () => {
  assert.throws(() => classifyIdempotency({ requestHash: 'a', responseStatus: 0, responseBody: {} }, 'b'), (error: unknown) => error instanceof PartnerApiError && error.code === 'idempotency_conflict')
  assert.throws(() => classifyIdempotency({ requestHash: 'a', responseStatus: 0, responseBody: {} }, 'a'), (error: unknown) => error instanceof PartnerApiError && error.code === 'request_in_progress')
  assert.deepEqual(classifyIdempotency({ requestHash: 'a', responseStatus: 202, responseBody: { id: 'one' } }, 'a'), { status: 202, body: { id: 'one' } })
  assert.equal(classifyIdempotency({ requestHash: 'a', responseStatus: 0, responseBody: {}, expiresAt: new Date(0) }, 'a'), null)
})

test('DNS pinning resolves once and rejects any mixed public/private answer set', async () => {
  let calls = 0
  const pinned = await resolvePublicHost('webhook.example', async () => { calls++; return [{ address: '8.8.8.8', family: 4 }] })
  assert.equal(pinned.address, '8.8.8.8')
  assert.equal(calls, 1)
  await assert.rejects(() => resolvePublicHost('rebind.example', async () => [
    { address: '8.8.8.8', family: 4 }, { address: '127.0.0.1', family: 4 },
  ]))
})

test('pinned DNS lookup honors scalar and all-address callback shapes', () => {
  const lookup = createPinnedLookup({ address: '8.8.8.8', family: 4 })
  let scalar: unknown[] = []
  let all: unknown[] = []
  lookup('images.example', {}, (...args) => { scalar = args })
  lookup('images.example', { all: true }, (...args) => { all = args })
  assert.deepEqual(scalar, [null, '8.8.8.8', 4])
  assert.deepEqual(all, [null, [{ address: '8.8.8.8', family: 4 }]])
})

test('OAuth scopes safely union standard scope and permissions claims', () => {
  assert.deepEqual([...partnerScopesFromClaims({ scope: 'openid submissions:write', permissions: [] })], ['openid', 'submissions:write'])
  assert.deepEqual([...partnerScopesFromClaims({ scope: 'submissions:read', permissions: ['corrections:write', 'submissions:read'] })], ['submissions:read', 'corrections:write'])
  assert.deepEqual([...partnerScopesFromClaims({ permissions: ['submissions:write'] })], ['submissions:write'])
  assert.deepEqual([...partnerScopesFromClaims({ scp: ['openid', 'submissions:write'] })], ['openid', 'submissions:write'])
  assert.deepEqual([...partnerScopesFromClaims({ scope: 'submissions:read', scp: ['submissions:read', 'submissions:write', 42], permissions: ['corrections:write'] })], ['submissions:read', 'submissions:write', 'corrections:write'])
  assert.deepEqual([...partnerScopesFromClaims({ scp: 'submissions:write' })], [])
  assert.deepEqual([...partnerScopesFromClaims({ scope: 42 as never, permissions: ['submissions:read', 99, null] })], ['submissions:read'])
  assert.deepEqual(missingPartnerScopes(partnerScopesFromClaims({ scope: 'catalog:read', permissions: [] }), ['catalog:read', 'submissions:write']), ['submissions:write'])
})

test('production composition requires shared Redis and isolated Hydra bootstrap', () => {
  const compose = readFileSync(new URL('../docker-compose.yml', import.meta.url), 'utf8')
  const init = readFileSync(new URL('../ops/postgres/init-hydra-db.sh', import.meta.url), 'utf8')
  assert.match(compose, /redis:\/\/redis:6379/)
  assert.match(compose, /redis_data:\/data/)
  assert.match(compose, /HYDRA_DB_PASSWORD:\?HYDRA_DB_PASSWORD is required/)
  assert.match(init, /CREATE ROLE/)
  assert.match(init, /CREATE DATABASE/)
})

test('OAuth identity mapping is strict subject-only and lifecycle writes are serialized', () => {
  const authSource = readFileSync(new URL('../src/lib/partner-api/auth.ts', import.meta.url), 'utf8')
  const lifecycleSource = readFileSync(new URL('../src/app/api/admin/partner/lifecycle/[id]/route.ts', import.meta.url), 'utf8')
  assert.match(authSource, /findUnique\(\{ where: \{ id: payload\.sub \}/)
  assert.doesNotMatch(authSource, /payload\.email/)
  assert.match(lifecycleSource, /pg_advisory_xact_lock/)
  assert.match(lifecycleSource, /TransactionIsolationLevel\.Serializable/)
})

test('partner provisioning is idempotent unless intentional rotation is requested', () => {
  const source = readFileSync(new URL('../scripts/provision-partner.ts', import.meta.url), 'utf8')
  assert.match(source, /PARTNER_ROTATE_SECRETS/)
  assert.match(source, /Configuration updated without rotating credentials/)
  assert.match(source, /webhookUrl/)
})

test('published partner OpenAPI is parser-valid OpenAPI 3.1', async () => {
  const document = await SwaggerParser.validate(new URL('../public/openapi/partner-v1.yaml', import.meta.url).pathname)
  assert.equal((document as { openapi?: string }).openapi, '3.1.0')
  assert.ok(document.paths?.['/catalog/switches'])
  assert.ok(document.paths?.['/submissions'])
})

test('partner runbook separates temporary SwitchBook acceptance from partner handoff', () => {
  const runbook = readFileSync(new URL('../docs/partner-api-runbook.md', import.meta.url), 'utf8')
  assert.match(runbook, /https:\/\/switchbook\.app\/developers\/sandbox/)
  assert.match(runbook, /https:\/\/switchbook\.app\/openapi\/partner-v1\.yaml/)
  assert.match(runbook, /handoff provisioning remains blocked/)
  assert.match(runbook, /temporary SwitchBook-owned client/)
  assert.match(runbook, /failed cleanup fails acceptance/)
  assert.doesNotMatch(runbook, /keebvault\.example/)
})

test('webhook response drain rejects declared and streamed oversized bodies', async () => {
  await assert.rejects(() => drainLimitedResponse(new Response('small', { headers: { 'content-length': '999999' } }), 64))
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) { controller.enqueue(new Uint8Array(40)) },
    cancel() { cancelled = true },
  })
  await assert.rejects(() => drainLimitedResponse(new Response(stream), 64))
  assert.equal(cancelled, true)
})

test('write routes use one atomic idempotency transaction for business data and replay response', () => {
  const helper = readFileSync(new URL('../src/lib/partner-api/idempotency.ts', import.meta.url), 'utf8')
  const submission = readFileSync(new URL('../src/app/api/v1/submissions/route.ts', import.meta.url), 'utf8')
  const correction = readFileSync(new URL('../src/app/api/v1/catalog/switches/[id]/corrections/route.ts', import.meta.url), 'utf8')
  assert.match(helper, /const result = await work\(tx\)/)
  assert.match(helper, /tx\.partnerIdempotencyKey\.update/)
  assert.match(helper, /TransactionIsolationLevel\.Serializable/)
  assert.match(submission, /runIdempotentTransaction/)
  assert.match(correction, /runIdempotentTransaction/)
  assert.doesNotMatch(submission, /beginIdempotent/)
  assert.doesNotMatch(correction, /beginIdempotent/)
})
