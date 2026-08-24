import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { hydraAdmin } from '@/lib/partner-api/hydra'

type LoginRequest = { skip: boolean; subject: string }
type Accepted = { redirect_to: string }

export async function GET(request: Request) {
  const challenge = new URL(request.url).searchParams.get('login_challenge')
  if (!challenge) return NextResponse.json({ error: 'login_challenge is required' }, { status: 400 })
  const session = await auth()
  if (!session?.user?.id) {
    const callback = `/api/oauth/login?login_challenge=${encodeURIComponent(challenge)}`
    return NextResponse.redirect(new URL(`/auth/login?callbackUrl=${encodeURIComponent(callback)}`, request.url))
  }
  const login = await hydraAdmin<LoginRequest>(`/admin/oauth2/auth/requests/login?login_challenge=${encodeURIComponent(challenge)}`)
  const accepted = await hydraAdmin<Accepted>(`/admin/oauth2/auth/requests/login/accept?login_challenge=${encodeURIComponent(challenge)}`, {
    method: 'PUT', body: JSON.stringify({ subject: session.user.id, remember: true, remember_for: 3600, context: { username: session.user.name } }),
  })
  return NextResponse.redirect(accepted.redirect_to)
}
