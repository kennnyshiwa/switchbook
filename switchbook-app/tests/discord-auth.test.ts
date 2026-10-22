import assert from 'node:assert/strict'
import test from 'node:test'
import { Auth, customFetch, type AuthConfig } from '@auth/core'
import { discordProvider } from '../src/lib/discord-provider'

const origin = 'https://switchbook.example'

async function discordCallback(issuer: string | null, options: { tamperPkce?: boolean; deny?: boolean } = {}) {
  const requests: string[] = []
  const errors: string[] = []
  const provider = {
    ...discordProvider,
    options: {
      ...discordProvider.options,
      clientId: 'test-discord-client',
      clientSecret: 'test-discord-secret',
      [customFetch]: async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input)
        requests.push(url)
        if (url === 'https://discord.com/api/oauth2/token') {
          const body = new URLSearchParams(init?.body as string)
          assert.equal(body.get('redirect_uri'), `${origin}/api/auth/callback/discord`)
          assert.ok(body.get('code_verifier'))
          return Response.json({ access_token: 'test-access-token', token_type: 'Bearer', expires_in: 3600 })
        }
        assert.equal(url, 'https://discord.com/api/users/@me')
        return Response.json({ id: '123456789', username: 'test-user', global_name: 'Test User', discriminator: '0', avatar: null, email: 'test@example.invalid', verified: true })
      },
    },
  }
  const config: AuthConfig = {
    providers: [provider],
    secret: 'test-only-secret-that-is-long-enough',
    trustHost: true,
    basePath: '/api/auth',
    session: { strategy: 'jwt' },
    pages: { signIn: '/auth/login', error: '/auth/error' },
    logger: { error: error => { errors.push(error.name) } },
  }
  const jar = new Map<string, string>()
  function remember(response: Response) {
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';')[0]
      jar.set(pair.slice(0, pair.indexOf('=')), pair.slice(pair.indexOf('=') + 1))
    }
  }
  const cookieHeader = () => [...jar].map(([name, value]) => `${name}=${value}`).join('; ')
  const csrf = await Auth(new Request(`${origin}/api/auth/csrf`), config)
  remember(csrf)
  const { csrfToken } = await csrf.json()
  const signIn = await Auth(new Request(`${origin}/api/auth/signin/discord`, {
    method: 'POST',
    headers: { cookie: cookieHeader(), 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ csrfToken, callbackUrl: `${origin}/dashboard` }),
  }), config)
  remember(signIn)
  const authorization = new URL(signIn.headers.get('location')!)
  assert.equal(authorization.origin, 'https://discord.com')
  assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256')
  const callback = new URL(`${origin}/api/auth/callback/discord`)
  callback.searchParams.set(options.deny ? 'error' : 'code', options.deny ? 'access_denied' : 'test-code')
  if (issuer !== null) callback.searchParams.set('iss', issuer)
  if (authorization.searchParams.has('state')) callback.searchParams.set('state', authorization.searchParams.get('state')!)
  if (options.tamperPkce) {
    for (const name of jar.keys()) if (name.includes('pkce')) jar.delete(name)
  }
  const response = await Auth(new Request(callback, { headers: { cookie: cookieHeader() } }), config)
  remember(response)
  const session = await Auth(new Request(`${origin}/api/auth/session`, { headers: { cookie: cookieHeader() } }), config)
  return { response, requests, errors, session: await session.json() }
}

test('Discord callback with its RFC 9207 issuer completes token exchange and creates a session', async () => {
  const result = await discordCallback('https://discord.com')
  assert.equal(result.response.headers.get('location'), `${origin}/dashboard`)
  assert.equal(result.session.user.email, 'test@example.invalid')
  assert.equal(result.requests.length, 2)
  assert.deepEqual(result.errors, [])
})

test('Discord callbacks without the optional issuer remain compatible', async () => {
  const result = await discordCallback(null)
  assert.equal(result.response.headers.get('location'), `${origin}/dashboard`)
  assert.equal(result.requests.length, 2)
})

test('a wrong Discord callback issuer is rejected before token exchange', async () => {
  const result = await discordCallback('https://attacker.example')
  assert.equal(new URL(result.response.headers.get('location')!).pathname, '/auth/error')
  assert.equal(result.requests.length, 0)
  assert.equal(result.session, null)
})

test('Discord callbacks still require their PKCE cookie', async () => {
  const result = await discordCallback('https://discord.com', { tamperPkce: true })
  assert.equal(new URL(result.response.headers.get('location')!).pathname, '/auth/error')
  assert.equal(result.requests.length, 0)
  assert.equal(result.session, null)
})

test('Discord authorization denial returns to the login route', async () => {
  const result = await discordCallback('https://discord.com', { deny: true })
  assert.equal(new URL(result.response.headers.get('location')!).pathname, '/auth/login')
  assert.equal(result.requests.length, 0)
  assert.equal(result.session, null)
})
