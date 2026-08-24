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
  if (!redirectUri || !redirectUri.startsWith('https://') || new URL(redirectUri).origin === 'null') throw new Error('PARTNER_REDIRECT_URI must be an exact HTTPS callback URL')
  const clientId = process.env.PARTNER_CLIENT_ID || `keebvault_${randomBytes(8).toString('hex')}`
  const clientSecret = randomBytes(32).toString('base64url')
  const apiKey = issuePartnerKey()
  const webhookSecret = randomBytes(32).toString('base64url')
  const application = await prisma.partnerApplication.upsert({
    where: { clientId },
    create: { name, clientId, secretHash: sha256(clientSecret), scopes: [...PARTNER_SCOPES], redirectUris: [redirectUri], webhookUrl, webhookSecretEnvelope: sealSecret(webhookSecret) },
    update: { name, secretHash: sha256(clientSecret), scopes: [...PARTNER_SCOPES], redirectUris: [redirectUri], webhookUrl, webhookSecretEnvelope: sealSecret(webhookSecret), active: true },
  })
  await prisma.partnerCredential.create({ data: { applicationId: application.id, prefix: apiKey.prefix, secretHash: apiKey.hash, scopes: ['catalog:read'] } })
  const hydraClient = {
    client_id: clientId, client_name: name, client_secret: clientSecret,
    redirect_uris: [redirectUri], grant_types: ['authorization_code','refresh_token'],
    response_types: ['code'], scope: ['openid','offline_access',...PARTNER_SCOPES].join(' '),
    token_endpoint_auth_method: 'client_secret_basic', audience: ['https://switchbook.app/api/v1'],
  }
  let response = await fetch(`${hydraAdmin}/admin/clients`, { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(hydraClient) })
  if (response.status === 409) response = await fetch(`${hydraAdmin}/admin/clients/${encodeURIComponent(clientId)}`, { method: 'PUT', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(hydraClient) })
  if (!response.ok) throw new Error(`Hydra client provisioning failed: ${response.status} ${await response.text()}`)
  console.log(JSON.stringify({ applicationId: application.id, clientId, clientSecret, apiKey: apiKey.raw, webhookSecret, redirectUri }, null, 2))
  console.error('Store these values now; raw secrets are never persisted or displayed again.')
}
main().finally(() => prisma.$disconnect())
