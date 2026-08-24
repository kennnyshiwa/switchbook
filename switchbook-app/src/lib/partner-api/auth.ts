import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose'
import { prisma } from '@/lib/prisma'
import { PartnerApiError } from './errors'
import { secureEqualHash, sha256 } from './crypto'
import { consumeRateLimit } from './rate-limit'
import type { PartnerScope } from './config'

export type PartnerPrincipal = {
  applicationId: string
  clientId: string
  scopes: Set<string>
  userId?: string
  subject?: string
  rateLimit: number
}

export function missingPartnerScopes(granted: Set<string>, required: PartnerScope[]) {
  return required.filter(scope => !granted.has(scope))
}

export function partnerScopesFromClaims(payload: unknown) {
  const claims = typeof payload === 'object' && payload !== null ? payload as { scope?: unknown; permissions?: unknown } : {}
  const scopes = new Set<string>()
  if (typeof claims.scope === 'string') {
    for (const scope of claims.scope.split(/\s+/).filter(Boolean)) scopes.add(scope)
  } else if (Array.isArray(claims.scope)) {
    for (const scope of claims.scope) if (typeof scope === 'string' && scope) scopes.add(scope)
  }
  if (Array.isArray(claims.permissions)) {
    for (const scope of claims.permissions) if (typeof scope === 'string' && scope) scopes.add(scope)
  }
  return scopes
}

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined

function bearer(request: Request) {
  const value = request.headers.get('authorization')
  return value?.startsWith('Bearer ') ? value.slice(7) : null
}

async function verifyUserToken(token: string): Promise<JWTPayload> {
  const issuer = process.env.PARTNER_OIDC_ISSUER?.replace(/\/$/, '')
  const audience = process.env.PARTNER_OIDC_AUDIENCE
  if (!issuer || !audience) throw new PartnerApiError(503, 'oauth_unavailable', 'Partner OAuth is not configured')
  jwks ||= createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`))
  const verified = await jwtVerify(token, jwks, { issuer, audience })
  return verified.payload
}

export async function requirePartner(request: Request, required: PartnerScope[]): Promise<PartnerPrincipal> {
  const apiKey = request.headers.get('x-api-key')
  const token = bearer(request)
  let principal: PartnerPrincipal

  if (apiKey?.startsWith('sbk_')) {
    const prefix = apiKey.split('.')[0]
    const credential = await prisma.partnerCredential.findUnique({
      where: { prefix },
      include: { application: true },
    })
    if (!credential || credential.revokedAt || credential.expiresAt && credential.expiresAt <= new Date() ||
        !credential.application.active || !secureEqualHash(apiKey, credential.secretHash)) {
      throw new PartnerApiError(401, 'invalid_client', 'Invalid or revoked application credential')
    }
    const scopes = new Set(credential.scopes.filter(scope => credential.application.scopes.includes(scope)))
    principal = {
      applicationId: credential.applicationId,
      clientId: credential.application.clientId,
      scopes,
      rateLimit: credential.application.rateLimitPerMinute,
    }
    void prisma.partnerCredential.update({ where: { id: credential.id }, data: { lastUsedAt: new Date() } })
  } else if (token) {
    let payload: JWTPayload
    try { payload = await verifyUserToken(token) } catch { throw new PartnerApiError(401, 'invalid_token', 'Invalid or expired OAuth access token') }
    const clientId = String(payload.azp || payload.client_id || '')
    const app = await prisma.partnerApplication.findUnique({ where: { clientId } })
    if (!app?.active || !payload.sub) throw new PartnerApiError(401, 'invalid_token', 'Unknown OAuth client or subject')
    const scopes = new Set([...partnerScopesFromClaims(payload)].filter(scope => app.scopes.includes(scope)))
    const user = await prisma.user.findUnique({ where: { id: payload.sub }, select: { id: true } })
    if (!user) throw new PartnerApiError(403, 'account_not_linked', 'OAuth identity is not linked to a SwitchBook user')
    principal = { applicationId: app.id, clientId, scopes, userId: user.id, subject: payload.sub, rateLimit: app.rateLimitPerMinute }
  } else {
    throw new PartnerApiError(401, 'unauthorized', 'Provide an application key or OAuth bearer token')
  }

  const missing = missingPartnerScopes(principal.scopes, required)
  if (missing.length) throw new PartnerApiError(403, 'insufficient_scope', `Missing scope: ${missing.join(', ')}`)

  const limit = await consumeRateLimit(principal.applicationId, principal.rateLimit)
  if (!limit.allowed) throw new PartnerApiError(429, 'rate_limited', 'Rate limit exceeded', { resetAt: new Date(limit.resetAt).toISOString() })
  return principal
}

export async function auditPartner(request: Request, principal: PartnerPrincipal | null, action: string, statusCode: number, resource?: { type: string; id?: string }) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  await prisma.partnerAuditEvent.create({ data: {
    applicationId: principal?.applicationId,
    actorUserId: principal?.userId,
    requestId,
    action,
    resourceType: resource?.type,
    resourceId: resource?.id,
    statusCode,
    ipHash: forwarded ? sha256(`${process.env.AUDIT_IP_SALT || 'switchbook'}:${forwarded}`) : null,
  }}).catch(error => console.error('[partner-audit]', requestId, error))
  console.info(JSON.stringify({ event: 'partner_api_request', requestId, applicationId: principal?.applicationId, userId: principal?.userId, action, statusCode, resource }))
  return requestId
}
