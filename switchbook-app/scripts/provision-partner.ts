import { randomBytes } from 'node:crypto'
import { prisma } from '../src/lib/prisma'
import { issuePartnerKey, sealSecret, sha256 } from '../src/lib/partner-api/crypto'
import { PARTNER_SCOPES } from '../src/lib/partner-api/config'
import { assertSafeWebhookUrl } from '../src/lib/partner-api/outbound'

async function main() {
  const name = process.env.PARTNER_NAME || 'KeebVault'
  const redirectUri = process.env.PARTNER_REDIRECT_URI
  const hydraAdmin = (process.env.HYDRA_ADMIN_URL || 'http://127.0.0.1:4445').replace(/\/$/, '')
  const webhookUrl = process.env.PARTNER_WEBHOOK_URL ? await assertSafeWebhookUrl(process.env.PARTNER_WEBHOOK_URL) : null
  const rotate = process.env.PARTNER_ROTATE_SECRETS === 'true'
  if (!redirectUri || !redirectUri.startsWith('https://') || new URL(redirectUri).origin === 'null') throw new Error('PARTNER_REDIRECT_URI must be an exact HTTPS callback URL')

  const requestedClientId = process.env.PARTNER_CLIENT_ID
  const existing = requestedClientId ? await prisma.partnerApplication.findUnique({ where: { clientId: requestedClientId } }) : null
  const clientId = existing?.clientId || requestedClientId || `keebvault_${randomBytes(8).toString('hex')}`
  const clientSecret = !existing || rotate ? randomBytes(32).toString('base64url') : null
  const apiKey = !existing || rotate ? issuePartnerKey() : null
  const webhookSecret = !existing || rotate ? randomBytes(32).toString('base64url') : null

  const application = existing
    ? await prisma.partnerApplication.update({ where: { id: existing.id }, data: {
        name, scopes: [...PARTNER_SCOPES], redirectUris: [redirectUri], webhookUrl, active: true,
        ...(clientSecret ? { secretHash: sha256(clientSecret) } : {}),
        ...(webhookSecret ? { webhookSecretEnvelope: sealSecret(webhookSecret) } : {}),
      } })
    : await prisma.partnerApplication.create({ data: {
        name, clientId, secretHash: sha256(clientSecret!), scopes: [...PARTNER_SCOPES], redirectUris: [redirectUri],
        webhookUrl, webhookSecretEnvelope: sealSecret(webhookSecret!),
      } })

  if (apiKey) {
    if (existing && rotate) await prisma.partnerCredential.updateMany({ where: { applicationId: application.id, revokedAt: null }, data: { revokedAt: new Date() } })
    await prisma.partnerCredential.create({ data: { applicationId: application.id, prefix: apiKey.prefix, secretHash: apiKey.hash, scopes: ['catalog:read'] } })
  }

  const desired = {
    client_id: clientId, client_name: name,
    ...(clientSecret ? { client_secret: clientSecret } : {}),
    redirect_uris: [redirectUri], grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'],
    scope: ['openid', 'offline_access', ...PARTNER_SCOPES].join(' '), token_endpoint_auth_method: 'client_secret_basic',
    audience: ['https://switchbook.app/api/v1'],
  }
  let hydraExisting = await fetch(`${hydraAdmin}/admin/clients/${encodeURIComponent(clientId)}`)
  let response: Response
  if (hydraExisting.status === 404) {
    if (!clientSecret) throw new Error('Hydra client is missing; rerun with PARTNER_ROTATE_SECRETS=true to recreate it')
    response = await fetch(`${hydraAdmin}/admin/clients`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(desired) })
  } else {
    if (!hydraExisting.ok) throw new Error(`Hydra client lookup failed: ${hydraExisting.status}`)
    const current = await hydraExisting.json() as Record<string, unknown>
    response = await fetch(`${hydraAdmin}/admin/clients/${encodeURIComponent(clientId)}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...current, ...desired }) })
  }
  if (!response.ok) throw new Error(`Hydra client provisioning failed: ${response.status} ${await response.text()}`)

  console.log(JSON.stringify({
    applicationId: application.id, clientId, redirectUri, webhookUrl,
    rotated: Boolean(existing && rotate),
    ...(clientSecret ? { clientSecret } : {}), ...(apiKey ? { apiKey: apiKey.raw } : {}), ...(webhookSecret ? { webhookSecret } : {}),
  }, null, 2))
  console.error(clientSecret ? 'Store the newly issued values now; raw secrets are never displayed again.' : 'Configuration updated without rotating credentials. Set PARTNER_ROTATE_SECRETS=true only during an intentional coordinated rotation.')
}
main().finally(() => prisma.$disconnect())
