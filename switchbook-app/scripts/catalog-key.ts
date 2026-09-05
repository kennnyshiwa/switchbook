import { Prisma, PrismaClient } from '@prisma/client'
import { randomBytes, randomUUID } from 'node:crypto'
import { prisma } from '../src/lib/prisma'
import { CatalogKeyCommit, CatalogKeyLifecycleStore, CatalogKeyMetadata, issueCatalogKeyToFile, revokeCatalogKeys } from '../src/lib/partner-api/catalog-keys'
import { sha256 } from '../src/lib/partner-api/crypto'

const CATALOG_SCOPE = 'catalog:read' as const
const MIN_RATE_LIMIT = 1
const MAX_RATE_LIMIT = 600

function argumentMap(args: string[]) {
  const command = args[0]
  const flags = new Map<string, string>()
  for (let index = 1; index < args.length; index += 2) {
    const flag = args[index]
    const value = args[index + 1]
    if (!flag?.startsWith('--') || !value || value.startsWith('--')) throw new Error(`Expected a value after ${flag || 'command'}`)
    if (flags.has(flag)) throw new Error(`Duplicate option: ${flag}`)
    flags.set(flag, value)
  }
  return { command, flags }
}

function onlyFlags(flags: Map<string, string>, allowed: string[]) {
  for (const flag of flags.keys()) if (!allowed.includes(flag)) throw new Error(`Unknown option: ${flag}`)
}

function required(flags: Map<string, string>, flag: string) {
  const value = flags.get(flag)?.trim()
  if (!value) throw new Error(`${flag} is required`)
  return value
}

function parseRateLimit(value: string | undefined, fallback?: number) {
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < MIN_RATE_LIMIT || parsed > MAX_RATE_LIMIT) throw new Error(`--rate-limit must be an integer from ${MIN_RATE_LIMIT} to ${MAX_RATE_LIMIT}`)
  return parsed
}

function parseExpiry(value: string | undefined) {
  if (!value) return null
  const parsed = new Date(value)
  if (!Number.isFinite(parsed.getTime()) || parsed <= new Date()) throw new Error('--expires-at must be a future ISO-8601 timestamp')
  return parsed
}

function auditData(applicationId: string, action: string, resourceId: string, metadata: Prisma.InputJsonValue) {
  return {
    applicationId, requestId: `operator-${randomUUID()}`, action, resourceType: 'partner_credential',
    resourceId, statusCode: 200, metadata,
  }
}

export class PrismaCatalogKeyStore implements CatalogKeyLifecycleStore {
  constructor(private readonly db: PrismaClient) {}

  async commitCredential(input: CatalogKeyCommit, publishSecret: () => Promise<void>): Promise<CatalogKeyMetadata> {
    return this.db.$transaction(async tx => {
      const now = new Date()
      let application
      if (input.mode === 'issue') {
        const name = input.name?.trim()
        if (!name || name.length > 120) throw new Error('--name must contain 1 to 120 characters')
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'catalog-name:' + name.toLocaleLowerCase('und')}))`
        const duplicate = await tx.partnerApplication.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { clientId: true } })
        if (duplicate) throw new Error(`An application named ${name} already exists; target its exact clientId for status or rotation`)
        const discardedOauthSecret = randomBytes(32)
        try {
          application = await tx.partnerApplication.create({ data: {
            name, clientId: `catalog_${randomBytes(8).toString('hex')}`,
            secretHash: sha256(discardedOauthSecret), scopes: [CATALOG_SCOPE], redirectUris: [],
            webhookUrl: null, webhookSecretEnvelope: null, active: true,
            rateLimitPerMinute: input.rateLimitPerMinute ?? 120,
          } })
        } finally { discardedOauthSecret.fill(0) }
      } else {
        const clientId = input.application?.trim()
        if (!clientId) throw new Error('--application must be the exact clientId')
        const found = await tx.partnerApplication.findUnique({ where: { clientId } })
        if (!found) throw new Error(`Catalog application not found: ${clientId}`)
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.id}))`
        application = await tx.partnerApplication.findUniqueOrThrow({ where: { id: found.id } })
        if (!application.active || application.redirectUris.length || application.scopes.length !== 1 || application.scopes[0] !== CATALOG_SCOPE) {
          throw new Error('Rotation is limited to active catalog-only applications')
        }
        if (input.rateLimitPerMinute !== undefined) application = await tx.partnerApplication.update({ where: { id: application.id }, data: { rateLimitPerMinute: input.rateLimitPerMinute } })
        await tx.partnerCredential.updateMany({ where: { applicationId: application.id, revokedAt: null }, data: { revokedAt: now } })
      }
      const credential = await tx.partnerCredential.create({ data: {
        applicationId: application.id, prefix: input.prefix, secretHash: input.secretHash,
        scopes: [CATALOG_SCOPE], expiresAt: input.expiresAt,
      } })
      await tx.partnerAuditEvent.create({ data: auditData(application.id, input.mode === 'issue' ? 'catalog_key.issue' : 'catalog_key.rotate', credential.id, {
        prefix: input.prefix, expiresAt: input.expiresAt?.toISOString() || null,
        rateLimitPerMinute: application.rateLimitPerMinute,
      }) })
      await publishSecret()
      return {
        applicationId: application.id, clientId: application.clientId, applicationName: application.name,
        prefix: input.prefix, scopes: [CATALOG_SCOPE], rateLimitPerMinute: application.rateLimitPerMinute,
        expiresAt: input.expiresAt?.toISOString() || null, createdAt: credential.createdAt.toISOString(),
        rotated: input.mode === 'rotate',
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  async revokeCredentials(applicationClientId: string, prefix?: string) {
    return this.db.$transaction(async tx => {
      const found = await tx.partnerApplication.findUnique({ where: { clientId: applicationClientId } })
      if (!found) throw new Error(`Catalog application not found: ${applicationClientId}`)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${found.id}))`
      if (found.redirectUris.length || found.scopes.length !== 1 || found.scopes[0] !== CATALOG_SCOPE) throw new Error('Revocation is limited to catalog-only applications')
      const where = { applicationId: found.id, revokedAt: null, ...(prefix ? { prefix } : {}) }
      const matching = await tx.partnerCredential.findMany({ where, select: { id: true, prefix: true } })
      if (!matching.length) throw new Error(prefix ? `No active credential ${prefix} belongs to ${applicationClientId}` : `No active credentials belong to ${applicationClientId}`)
      if (prefix && matching.length !== 1) throw new Error('Credential prefix is ambiguous')
      const revokedAt = new Date()
      await tx.partnerCredential.updateMany({ where: { id: { in: matching.map(item => item.id) }, revokedAt: null }, data: { revokedAt } })
      await tx.partnerAuditEvent.create({ data: auditData(found.id, 'catalog_key.revoke', prefix || found.id, {
        prefixes: matching.map(item => item.prefix).sort(), revokedAt: revokedAt.toISOString(),
      }) })
      return { clientId: found.clientId, applicationName: found.name, revokedPrefixes: matching.map(item => item.prefix).sort(), revokedAt: revokedAt.toISOString() }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }
}

async function inspect(application?: string) {
  const where = application ? { clientId: application } : { scopes: { equals: [CATALOG_SCOPE] }, redirectUris: { isEmpty: true } }
  const applications = await prisma.partnerApplication.findMany({ where, orderBy: { clientId: 'asc' }, include: {
    credentials: { orderBy: { createdAt: 'desc' }, select: { prefix: true, scopes: true, expiresAt: true, revokedAt: true, lastUsedAt: true, createdAt: true } },
  } })
  if (application && applications.length !== 1) throw new Error(`Catalog application not found: ${application}`)
  return applications.map(app => ({
    applicationId: app.id, clientId: app.clientId, applicationName: app.name, active: app.active,
    scopes: app.scopes, rateLimitPerMinute: app.rateLimitPerMinute, createdAt: app.createdAt.toISOString(), updatedAt: app.updatedAt.toISOString(),
    credentials: app.credentials.map(credential => ({ ...credential, expiresAt: credential.expiresAt?.toISOString() || null, revokedAt: credential.revokedAt?.toISOString() || null, lastUsedAt: credential.lastUsedAt?.toISOString() || null, createdAt: credential.createdAt.toISOString() })),
  }))
}

export async function runCatalogKeyCli(args: string[], output: Pick<NodeJS.WriteStream, 'write'> = process.stdout) {
  const { command, flags } = argumentMap(args)
  let result: unknown
  if (command === 'issue') {
    onlyFlags(flags, ['--name', '--output', '--rate-limit', '--expires-at'])
    result = await issueCatalogKeyToFile({ mode: 'issue', name: required(flags, '--name'), outputPath: required(flags, '--output'), rateLimitPerMinute: parseRateLimit(flags.get('--rate-limit'), 120), expiresAt: parseExpiry(flags.get('--expires-at')), store: new PrismaCatalogKeyStore(prisma) })
  } else if (command === 'rotate') {
    onlyFlags(flags, ['--application', '--output', '--rate-limit', '--expires-at'])
    result = await issueCatalogKeyToFile({ mode: 'rotate', application: required(flags, '--application'), outputPath: required(flags, '--output'), rateLimitPerMinute: parseRateLimit(flags.get('--rate-limit')), expiresAt: parseExpiry(flags.get('--expires-at')), store: new PrismaCatalogKeyStore(prisma) })
  } else if (command === 'revoke') {
    onlyFlags(flags, ['--application', '--prefix'])
    result = await revokeCatalogKeys(new PrismaCatalogKeyStore(prisma), required(flags, '--application'), flags.get('--prefix'))
  } else if (command === 'list') {
    onlyFlags(flags, [])
    result = await inspect()
  } else if (command === 'status') {
    onlyFlags(flags, ['--application'])
    result = (await inspect(required(flags, '--application')))[0]
  } else {
    throw new Error('Usage: catalog-key issue|rotate|revoke|list|status (see docs/SWITCHBOOK_PARTNER_API_HANDOFF.md)')
  }
  output.write(`${JSON.stringify(result, null, 2)}\n`)
  return result
}

if (require.main === module) {
  runCatalogKeyCli(process.argv.slice(2)).catch(error => {
    process.stderr.write(`catalog-key failed: ${error instanceof Error ? error.message : 'unknown error'}\n`)
    process.exitCode = 1
  }).finally(() => prisma.$disconnect())
}
