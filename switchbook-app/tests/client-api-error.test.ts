import assert from 'node:assert/strict'
import test from 'node:test'
import { apiErrorMessage, responseErrorMessage } from '../src/lib/client-api-error'

test('normal UI extracts legacy and structured JSON API errors', async () => {
  assert.equal(apiErrorMessage({ error: 'legacy error' }, 'fallback'), 'legacy error')
  assert.equal(apiErrorMessage({ message: 'message error' }, 'fallback'), 'message error')
  assert.equal(apiErrorMessage({ error: { code: 'invalid_request', message: 'structured error', requestId: 'req-1' } }, 'fallback'), 'structured error')
  assert.equal(apiErrorMessage({ error: { code: 'invalid_request' } }, 'fallback'), 'fallback')
  assert.equal(await responseErrorMessage(new Response('<html>', { status: 502 }), 'safe fallback'), 'safe fallback')
})
