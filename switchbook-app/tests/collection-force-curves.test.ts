import assert from 'node:assert/strict'
import test from 'node:test'
import { getApprovedCurvesByMasterSwitchIds } from '../src/lib/force-curves'
import { resolveCollectionForceCurves } from '../src/lib/collection-force-curves'
import { readFileSync } from 'node:fs'

test('collection force curves use one mapping query and preserve explicit empty master results', async () => {
  const calls: unknown[] = []
  const db = {
    forceCurveMapping: {
      findMany: async (query: unknown) => {
        calls.push(query)
        return [{
          masterSwitchId: 'master-one', state: 'MANUALLY_APPROVED', provenance: '{}',
          catalogEntry: {
            id: 'curve-one', source: 'github:ThereminGoat/force-curves', displayName: 'Exact Stock',
            repositoryPath: 'Exact Stock/Exact Stock Raw Data CSV.csv', exists: true,
          },
        }]
      },
    },
  }
  const approved = await getApprovedCurvesByMasterSwitchIds(['master-one', 'master-two', 'master-one'], db as never)
  assert.equal(calls.length, 1)
  assert.equal(approved['master-one'].length, 1)
  assert.deepEqual(approved['master-two'], [])
  assert.deepEqual((calls[0] as { where: { masterSwitchId: { in: string[] } } }).where.masterSwitchId.in, ['master-one', 'master-two'])

  const resolved = resolveCollectionForceCurves(approved, {
    status: 'ready',
    verifiedPaths: new Set(['Exact Stock/Exact Stock Raw Data CSV.csv']),
    collisionPaths: new Set(),
  })
  assert.equal(resolved['master-one'][0].url, 'https://switchesdb.switchbook.app/#Exact%20Stock~TG.csv')
  assert.equal(resolved['master-one'][0].sourceUrl, 'https://github.com/ThereminGoat/force-curves/blob/main/Exact%20Stock/Exact%20Stock%20Raw%20Data%20CSV.csv')
  assert.deepEqual(resolved['master-two'], [])
})

test('collection preload fails closed when exact inventory is unavailable', () => {
  const resolved = resolveCollectionForceCurves({
    master: [{
      id: 'curve', source: 'github:ThereminGoat/force-curves', folderName: 'Exact',
      path: 'Exact/Exact Raw Data CSV.csv', url: 'https://github.test', state: 'MANUALLY_APPROVED',
      provenance: 'ThereminGoat', condition: 'Measurement', measurementDate: null,
    }],
  }, { status: 'unavailable', verifiedPaths: new Set(), collisionPaths: new Set() })
  assert.deepEqual(resolved, { master: [] })
})

test('Personal Collections has no post-hydration availability waterfall', () => {
  const collection = readFileSync(new URL('../src/components/SwitchCollection.tsx', import.meta.url), 'utf8')
  assert.doesNotMatch(collection, /\/api\/force-curve-cache/)
  assert.doesNotMatch(collection, /\/api\/force-curve-batch-check/)
  assert.match(collection, /initialForceCurvesByMasterSwitchId/)
})
