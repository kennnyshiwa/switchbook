import assert from 'node:assert/strict'
import test from 'node:test'
import { loadAdminMasterSwitchData } from '../src/lib/admin-master-switch-loading'

test('browser request trace has one provider session and exactly one data pair on initial load', async () => {
  const trace = ['/api/auth/session']
  const fetcher = (async (input: RequestInfo | URL) => {
    trace.push(String(input))
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  await loadAdminMasterSwitchData('pending', fetcher)
  assert.deepEqual(trace, [
    '/api/auth/session',
    '/api/admin/master-switches?status=pending',
    '/api/admin/master-switch-edits?status=pending',
  ])
})

test('a genuine filter change makes one new data pair and no client session request', async () => {
  const trace: string[] = []
  const fetcher = (async (input: RequestInfo | URL) => {
    trace.push(String(input))
    return new Response('[]', { status: 200, headers: { 'content-type': 'application/json' } })
  }) as typeof fetch
  await loadAdminMasterSwitchData('pending', fetcher)
  await loadAdminMasterSwitchData('approved', fetcher)
  assert.deepEqual(trace, [
    '/api/admin/master-switches?status=pending',
    '/api/admin/master-switch-edits?status=pending',
    '/api/admin/master-switches?status=approved',
    '/api/admin/master-switch-edits?status=approved',
  ])
  assert.equal(trace.filter(url => url === '/api/auth/session').length, 0)
})
