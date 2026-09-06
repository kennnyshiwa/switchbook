import { Prisma, PrismaClient } from '@prisma/client'
import { randomBytes, randomUUID } from 'node:crypto'
import { issuePartnerKey, sha256 } from '@/lib/partner-api/crypto'

export const CATALOG_SCOPE = 'catalog:read' as const
export const MIN_INTEGRATION_RATE_LIMIT = 1
export const MAX_INTEGRATION_RATE_LIMIT = 600

export function isCatalogOnlyApplication(app: { scopes: string[]; redirectUris: string[]; webhookUrl: string | null; webhookSecretEnvelope: string | null }) {
  return app.scopes.length === 1 && app.scopes[0] === CATALOG_SCOPE && app.redirectUris.length === 0 && app.webhookUrl === null && app.webhookSecretEnvelope === null
}

export function publicCredential(credential: { id: string; prefix: string; scopes: string[]; createdAt: Date; expiresAt: Date | null; revokedAt: Date | null; lastUsedAt: Date | null }) {
  return {
    id: credential.id,
    prefix: credential.prefix,
    scopes: credential.scopes,
    createdAt: credential.createdAt.toISOString(),
    expiresAt: credential.expiresAt?.toISOString() ?? null,
    revokedAt: credential.revokedAt?.toISOString() ?? null,
    lastUsedAt: credential.lastUsedAt?.toISOString() ?? null,
  }
}

function audit(actorUserId: string, applicationId: string, action: string, resourceId: string, metadata: Prisma.InputJsonValue) {
  return {
    applicationId,
    actorUserId,
    requestId: `admin-${randomUUID()}`,
    action,
    resourceType: 'partner_credential',
    resourceId,
    statusCode: 200,
    metadata,
  }
}

export class AdminIntegrationStore {
  constructor(private readonly db: PrismaClient) {}

  async list() {
    const applications = await this.db.partnerApplication.findMany({
      where: { scopes: { equals: [CATALOG_SCOPE] }, redirectUris: { isEmpty: true }, webhookUrl: null, webhookSecretEnvelope: null },
      orderBy: { createdAt: 'desc' },
      include: {
        credentials: { orderBy: { createdAt: 'desc' }, select: { id: true, prefix: true, scopes: true, createdAt: true, expiresAt: true, revokedAt: true, lastUsedAt: true } },
        auditEvents: { orderBy: { createdAt: 'desc' }, take: 20, select: { id: true, actorUserId: true, action: true, resourceType: true, resourceId: true, createdAt: true } },
      },
    })
    return applications.filter(isCatalogOnlyApplication).map(app => ({
      id: app.id, name: app.name, clientId: app.clientId, active: app.active,
      scopes: app.scopes, rateLimitPerMinute: app.rateLimitPerMinute,
      createdAt: app.createdAt.toISOString(), updatedAt: app.updatedAt.toISOString(),
      credentials: app.credentials.map(publicCredential),
      auditEvents: app.auditEvents.map(event => ({ ...event, createdAt: event.createdAt.toISOString() })),
    }))
  }

  async create(input: { name: string; rateLimitPerMinute: number; expiresAt: Date | null; actorUserId: string }) {
    const key = issuePartnerKey()
    const discardedOauthSecret = randomBytes(32)
    try {
      return await this.db.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'admin-catalog-name:' + input.name.toLocaleLowerCase('und')}))`
        const duplicate = await tx.partnerApplication.findFirst({ where: { name: { equals: input.name, mode: 'insensitive' } }, select: { id: true } })
        if (duplicate) throw new Error('An application with that name already exists')
        const application = await tx.partnerApplication.create({ data: {
          name: input.name,
          clientId: `catalog_${randomBytes(8).toString('hex')}`,
          secretHash: sha256(discardedOauthSecret),
          scopes: [CATALOG_SCOPE], redirectUris: [], webhookUrl: null, webhookSecretEnvelope: null,
          active: true, rateLimitPerMinute: input.rateLimitPerMinute,
        } })
        const credential = await tx.partnerCredential.create({ data: {
          applicationId: application.id, prefix: key.prefix, secretHash: key.hash,
          scopes: [CATALOG_SCOPE], expiresAt: input.expiresAt,
        } })
        await tx.partnerAuditEvent.create({ data: audit(input.actorUserId, application.id, 'admin.catalog_key.issue', credential.id, {
          prefix: key.prefix, expiresAt: input.expiresAt?.toISOString() ?? null, rateLimitPerMinute: input.rateLimitPerMinute,
        }) })
        return { application: { id: application.id, name: application.name, clientId: application.clientId }, credential: publicCredential(credential), apiKey: key.raw }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } finally {
      discardedOauthSecret.fill(0)
    }
  }

  async rotate(input: { applicationId: string; revokeExisting: boolean; expiresAt: Date | null; actorUserId: string }) {
    const key = issuePartnerKey()
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.applicationId}))`
      const application = await tx.partnerApplication.findUnique({ where: { id: input.applicationId } })
      if (!application || !application.active || !isCatalogOnlyApplication(application)) throw new Error('Rotation is limited to active catalog-only applications')
      const rotatedAt = new Date()
      let revokedCount = 0
      if (input.revokeExisting) {
        const result = await tx.partnerCredential.updateMany({ where: { applicationId: application.id, revokedAt: null }, data: { revokedAt: rotatedAt } })
        revokedCount = result.count
      }
      const credential = await tx.partnerCredential.create({ data: {
        applicationId: application.id, prefix: key.prefix, secretHash: key.hash, scopes: [CATALOG_SCOPE], expiresAt: input.expiresAt,
      } })
      await tx.partnerAuditEvent.create({ data: audit(input.actorUserId, application.id, 'admin.catalog_key.rotate', credential.id, {
        prefix: key.prefix, expiresAt: input.expiresAt?.toISOString() ?? null, revokeExisting: input.revokeExisting, revokedCount,
      }) })
      return { credential: publicCredential(credential), apiKey: key.raw, revokedCount }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }

  async revoke(input: { applicationId: string; credentialId: string; actorUserId: string }) {
    return this.db.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${input.applicationId}))`
      const application = await tx.partnerApplication.findUnique({ where: { id: input.applicationId } })
      if (!application || !isCatalogOnlyApplication(application)) throw new Error('Revocation is limited to catalog-only applications')
      const credential = await tx.partnerCredential.findFirst({ where: { id: input.credentialId, applicationId: application.id }, select: { id: true, prefix: true, revokedAt: true } })
      if (!credential) throw new Error('Credential not found')
      if (credential.revokedAt) throw new Error('Credential is already revoked')
      const revokedAt = new Date()
      const changed = await tx.partnerCredential.updateMany({ where: { id: credential.id, revokedAt: null }, data: { revokedAt } })
      if (changed.count !== 1) throw new Error('Credential is already revoked')
      await tx.partnerAuditEvent.create({ data: audit(input.actorUserId, application.id, 'admin.catalog_key.revoke', credential.id, { prefix: credential.prefix, revokedAt: revokedAt.toISOString() }) })
      return { id: credential.id, prefix: credential.prefix, revokedAt: revokedAt.toISOString() }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
  }
}
