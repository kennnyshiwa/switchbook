import { randomBytes, timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hydraAdmin } from '@/lib/partner-api/hydra'
import { acceptedConsentGrant, allowedConsentScopes, HydraConsentRequest } from '@/lib/partner-api/consent'

type Accepted = { redirect_to: string }
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[char]!)

export async function GET(request: NextRequest) {
  const challenge = request.nextUrl.searchParams.get('consent_challenge')
  if (!challenge) return NextResponse.json({ error: 'consent_challenge is required' }, { status: 400 })
  const session = await auth()
  if (!session?.user?.id) return NextResponse.redirect(new URL(`/auth/login?callbackUrl=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`, request.url))
  const consent = await hydraAdmin<HydraConsentRequest>(`/admin/oauth2/auth/requests/consent?consent_challenge=${encodeURIComponent(challenge)}`)
  if (consent.subject !== session.user.id) return NextResponse.json({ error: 'OAuth subject mismatch' }, { status: 403 })
  const allowed = allowedConsentScopes(consent, consent.requested_scope)
  const nonce = randomBytes(24).toString('base64url')
  const scopes = allowed.map(scope => `<li><label><input type="checkbox" name="scope" value="${escapeHtml(scope)}" checked> ${escapeHtml(scope)}</label></li>`).join('')
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width"><title>Authorize KeebVault</title><style>body{font:16px system-ui;background:#111827;color:#f9fafb;display:grid;place-items:center;min-height:100vh}.card{max-width:38rem;padding:2rem;background:#1f2937;border-radius:1rem}button{padding:.75rem 1rem;margin:.5rem;border:0;border-radius:.5rem}ul{line-height:2}</style></head><body><main class="card"><h1>Authorize ${escapeHtml(consent.client.client_name || consent.client.client_id)}</h1><p>Choose what this app may do with your SwitchBook account.</p><form method="post"><input type="hidden" name="consent_challenge" value="${escapeHtml(challenge)}"><input type="hidden" name="nonce" value="${nonce}"><ul>${scopes}</ul><button name="decision" value="allow">Allow access</button><button name="decision" value="deny">Deny</button></form></main></body></html>`
  const response = new NextResponse(html, { headers: { 'Content-Type':'text/html; charset=utf-8', 'Cache-Control':'no-store', 'Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'" } })
  response.cookies.set('sb_oauth_consent', nonce, { httpOnly: true, secure: true, sameSite: 'lax', maxAge: 600, path: '/api/oauth/consent' })
  return response
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const form = await request.formData()
  const challenge = String(form.get('consent_challenge') || '')
  const nonce = String(form.get('nonce') || '')
  const cookieNonce = request.cookies.get('sb_oauth_consent')?.value || ''
  const validNonce = nonce.length > 20 && nonce.length === cookieNonce.length && timingSafeEqual(Buffer.from(nonce), Buffer.from(cookieNonce))
  if (!challenge || !validNonce) return NextResponse.json({ error: 'Invalid consent request' }, { status: 400 })
  const consent = await hydraAdmin<HydraConsentRequest>(`/admin/oauth2/auth/requests/consent?consent_challenge=${encodeURIComponent(challenge)}`)
  if (consent.subject !== session.user.id) return NextResponse.json({ error: 'OAuth subject mismatch' }, { status: 403 })
  const requested = form.getAll('scope').map(String)
  const decision = form.get('decision')
  const endpoint = decision === 'allow' ? 'accept' : 'reject'
  const body = decision === 'allow'
    ? acceptedConsentGrant(consent, requested, { username: session.user.name, email: session.user.email })
    : { error: 'access_denied', error_description: 'The user denied the request' }
  const result = await hydraAdmin<Accepted>(`/admin/oauth2/auth/requests/consent/${endpoint}?consent_challenge=${encodeURIComponent(challenge)}`, { method: 'PUT', body: JSON.stringify(body) })
  const response = NextResponse.redirect(result.redirect_to, 303)
  response.cookies.delete('sb_oauth_consent')
  return response
}
