import { constants } from 'node:fs'
import { open, unlink } from 'node:fs/promises'
import { issuePartnerKey } from './crypto'

export type CatalogKeyMetadata = {
  applicationId: string
  clientId: string
  applicationName: string
  prefix: string
  scopes: ['catalog:read']
  rateLimitPerMinute: number
  expiresAt: string | null
  createdAt: string
  rotated: boolean
}

export type CatalogKeyCommit = {
  mode: 'issue' | 'rotate'
  name?: string
  application?: string
  rateLimitPerMinute?: number
  expiresAt: Date | null
  prefix: string
  secretHash: string
}

export interface CatalogKeyStore {
  commitCredential(input: CatalogKeyCommit, publishSecret: () => Promise<void>): Promise<CatalogKeyMetadata>
}

export type CatalogKeyRevocationMetadata = {
  clientId: string
  applicationName: string
  revokedPrefixes: string[]
  revokedAt: string
}

export interface CatalogKeyLifecycleStore extends CatalogKeyStore {
  revokeCredentials(application: string, prefix?: string): Promise<CatalogKeyRevocationMetadata>
}

export async function revokeCatalogKeys(store: CatalogKeyLifecycleStore, application: string, prefix?: string) {
  if (!application.trim()) throw new Error('--application must be the exact clientId')
  if (prefix !== undefined && !/^sbk_[a-f0-9]{12}$/.test(prefix)) throw new Error('--prefix must be an exact non-secret sbk_ credential prefix')
  return store.revokeCredentials(application.trim(), prefix)
}

export async function issueCatalogKeyToFile(input: Omit<CatalogKeyCommit, 'prefix' | 'secretHash'> & {
  outputPath: string
  store: CatalogKeyStore
  generateKey?: typeof issuePartnerKey
}) {
  if (!input.outputPath.trim()) throw new Error('A caller-designated --output path is required')
  const key = (input.generateKey || issuePartnerKey)()
  let handle
  let published = false
  try {
    handle = await open(input.outputPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600)
    await handle.chmod(0o600)
    const metadata = await input.store.commitCredential({
      mode: input.mode, name: input.name, application: input.application,
      rateLimitPerMinute: input.rateLimitPerMinute, expiresAt: input.expiresAt,
      prefix: key.prefix, secretHash: key.hash,
    }, async () => {
      await handle!.writeFile(`${JSON.stringify({ apiKey: key.raw })}\n`, { encoding: 'utf8' })
      await handle!.sync()
      published = true
    })
    await handle.close()
    return metadata
  } catch (error) {
    await handle?.close().catch(() => undefined)
    if (handle || published) await unlink(input.outputPath).catch(() => undefined)
    throw error
  }
}
