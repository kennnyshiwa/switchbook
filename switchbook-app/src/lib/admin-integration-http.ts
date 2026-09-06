import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isSameOriginMutation } from '@/lib/admin-force-curves'

export const noStoreJson = (body: unknown, init?: ResponseInit) => NextResponse.json(body, {
  ...init,
  headers: { ...Object.fromEntries(new Headers(init?.headers).entries()), 'Cache-Control': 'no-store, private', Pragma: 'no-cache' },
})

export async function requireIntegrationAdmin(request?: { headers: Headers; nextUrl: { origin: string } }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') return { response: noStoreJson({ error: 'Administrator access required' }, { status: 403 }) }
  if (request && !isSameOriginMutation(request)) return { response: noStoreJson({ error: 'Same-origin request required' }, { status: 403 }) }
  return { actorUserId: session.user.id }
}

export function safeIntegrationError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Request failed'
  const allowed = /^(An application with that name already exists|Rotation is limited to active catalog-only applications|Revocation is limited to catalog-only applications|Credential not found|Credential is already revoked)$/
  return noStoreJson({ error: allowed.test(message) ? message : 'Integration request failed' }, { status: /not found/i.test(message) ? 404 : 400 })
}
