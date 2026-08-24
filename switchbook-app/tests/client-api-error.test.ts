import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { apiErrorMessage, responseErrorMessage, responseJsonBody } from '../src/lib/client-api-error'

test('normal UI extracts legacy and structured JSON API errors', async () => {
  assert.equal(apiErrorMessage({ error: 'legacy error' }, 'fallback'), 'legacy error')
  assert.equal(apiErrorMessage({ message: 'message error' }, 'fallback'), 'message error')
  assert.equal(apiErrorMessage({ error: { code: 'invalid_request', message: 'structured error', requestId: 'req-1' } }, 'fallback'), 'structured error')
  assert.equal(apiErrorMessage({ error: { code: 'invalid_request' } }, 'fallback'), 'fallback')
  assert.equal(await responseErrorMessage(new Response('<html>', { status: 502 }), 'safe fallback'), 'safe fallback')
  assert.equal(await responseJsonBody(new Response('<html>', { status: 502 })), null)
})

test('main submission call site uses safe response parsing', () => {
  const source = readFileSync(new URL('../src/app/switches/submit/page.tsx', import.meta.url), 'utf8')
  assert.match(source, /const responseData = await responseJsonBody\(response\)/)
  assert.doesNotMatch(source, /const responseData = await response\.json\(\)/)
})
