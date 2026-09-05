import assert from 'node:assert/strict'
import test from 'node:test'
import { access, mkdtemp, readFile, stat, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { CatalogKeyCommit, CatalogKeyLifecycleStore, CatalogKeyMetadata, issueCatalogKeyToFile, revokeCatalogKeys } from '../src/lib/partner-api/catalog-keys'
import { readFileSync } from 'node:fs'

class MockCatalogKeyStore implements CatalogKeyLifecycleStore {
  commits: CatalogKeyCommit[] = []
  published = false
  async commitCredential(input: CatalogKeyCommit, publishSecret: () => Promise<void>): Promise<CatalogKeyMetadata> {
    this.commits.push(input)
    await publishSecret()
    this.published = true
    return {
      applicationId: 'app-id', clientId: input.application || 'catalog_client', applicationName: input.name || 'Example',
      prefix: input.prefix, scopes: ['catalog:read'], rateLimitPerMinute: input.rateLimitPerMinute || 120,
      expiresAt: input.expiresAt?.toISOString() || null, createdAt: '2026-09-05T12:00:00.000Z', rotated: input.mode === 'rotate',
    }
  }
  async revokeCredentials(application: string, prefix?: string) {
    return { clientId: application, applicationName: 'Example', revokedPrefixes: [prefix || 'sbk_0123456789ab'], revokedAt: '2026-09-05T12:00:00.000Z' }
  }
}

const fixedKey = () => ({ prefix: 'sbk_0123456789ab', raw: ['sbk_0123456789ab', 'TEST_ONLY_RAW_KEY'].join('.'), hash: 'test-hash' })

test('catalog key issue writes the raw key once to an exclusive mode-0600 file and returns non-secret metadata', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'switchbook-catalog-key-'))
  t.after(async () => { const { rm } = await import('node:fs/promises'); await rm(directory, { recursive: true }) })
  const outputPath = join(directory, 'one-time.json')
  const store = new MockCatalogKeyStore()
  const metadata = await issueCatalogKeyToFile({ mode: 'issue', name: 'Catalog Reader', outputPath, rateLimitPerMinute: 45, expiresAt: null, store, generateKey: fixedKey })
  const rawFile = await readFile(outputPath, 'utf8')
  assert.equal((await stat(outputPath)).mode & 0o777, 0o600)
  assert.equal(JSON.parse(rawFile).apiKey, fixedKey().raw)
  assert.equal(JSON.stringify(metadata).includes(fixedKey().raw), false)
  assert.equal(JSON.stringify(store.commits).includes(fixedKey().raw), false)
  assert.deepEqual(store.commits[0].secretHash, fixedKey().hash)
  assert.equal(store.published, true)
})

test('rotation is explicit and never overwrites a caller path or commits when it already exists', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'switchbook-catalog-key-'))
  t.after(async () => { const { rm } = await import('node:fs/promises'); await rm(directory, { recursive: true }) })
  const outputPath = join(directory, 'existing.json')
  await writeFile(outputPath, 'preserve me', { mode: 0o600 })
  const store = new MockCatalogKeyStore()
  await assert.rejects(() => issueCatalogKeyToFile({ mode: 'rotate', application: 'catalog_exact', outputPath, expiresAt: null, store, generateKey: fixedKey }), /EEXIST/)
  assert.equal(await readFile(outputPath, 'utf8'), 'preserve me')
  assert.equal(store.commits.length, 0)
})

test('revocation requires an exact application and optional exact non-secret prefix', async () => {
  const store = new MockCatalogKeyStore()
  assert.deepEqual((await revokeCatalogKeys(store, 'catalog_exact', 'sbk_0123456789ab')).revokedPrefixes, ['sbk_0123456789ab'])
  await assert.rejects(() => revokeCatalogKeys(store, '', undefined), /--application/)
  await assert.rejects(() => revokeCatalogKeys(store, 'catalog_exact', 'sbk_short'), /--prefix/)
})

test('a transaction failure after publication removes the one-time file', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'switchbook-catalog-key-'))
  t.after(async () => { const { rm } = await import('node:fs/promises'); await rm(directory, { recursive: true }) })
  const outputPath = join(directory, 'rolled-back.json')
  const store = new MockCatalogKeyStore()
  store.commitCredential = async (_input, publishSecret) => { await publishSecret(); throw new Error('injected rollback') }
  await assert.rejects(() => issueCatalogKeyToFile({ mode: 'issue', name: 'Rollback', outputPath, expiresAt: null, store, generateKey: fixedKey }), /injected rollback/)
  await assert.rejects(() => access(outputPath), /ENOENT/)
})

test('catalog-key operator path is Hydra-independent, catalog-only, transactional, and auditable without secret output', () => {
  const source = readFileSync(new URL('../scripts/catalog-key.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(source, /hydra|redirect uri|client_secret/i)
  assert.match(source, /const CATALOG_SCOPE = 'catalog:read'/)
  assert.match(source, /redirectUris: \[\]/)
  assert.match(source, /TransactionIsolationLevel\.Serializable/)
  assert.match(source, /pg_advisory_xact_lock/)
  assert.match(source, /catalog_key\.issue/)
  assert.match(source, /catalog_key\.rotate/)
  assert.match(source, /catalog_key\.revoke/)
  assert.doesNotMatch(source, /key\.raw|apiKey/)
})
