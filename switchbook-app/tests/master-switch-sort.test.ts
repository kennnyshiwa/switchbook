import assert from 'node:assert/strict'
import test from 'node:test'
import { masterSwitchOrderBy } from '../src/lib/master-switch-sort'

test('master switch public sort aliases produce valid stable Prisma ordering', () => {
  assert.deepEqual(masterSwitchOrderBy('popular', 'desc'), [
    { viewCount: 'desc' },
    { userSwitches: { _count: 'desc' } },
    { id: 'asc' },
  ])
  assert.deepEqual(masterSwitchOrderBy('userCount', 'asc'), [
    { userSwitches: { _count: 'asc' } },
    { id: 'asc' },
  ])
  assert.deepEqual(masterSwitchOrderBy('name', 'asc'), [{ name: 'asc' }, { id: 'asc' }])
})
