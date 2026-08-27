import assert from 'node:assert/strict'
import test from 'node:test'
import { catalogUrl, resolveApprovedCurveRecords, selectAutomaticCandidates } from '../src/lib/force-curves'
const master = { id: 'm1', name: 'Peach', manufacturer: 'KTT', technology: 'MECHANICAL' as const }
const curve = (overrides = {}) => ({ id: 'c1', displayName: 'KTT Peach', manufacturer: 'KTT', technology: 'MECHANICAL' as const, exists: true, ...overrides })
test('automatic matching accepts one exact compatible candidate', () => assert.deepEqual(selectAutomaticCandidates(master, [curve()]).map(c => c.id), ['c1']))
test('automatic matching exposes ambiguity rather than choosing first', () => assert.equal(selectAutomaticCandidates(master, [curve(), curve({id:'c2'})]).length, 2))
test('missing, manufacturer-conflicting, technology-conflicting, and absent metadata fail closed', () => {
  assert.equal(selectAutomaticCandidates(master, [curve({exists:false})]).length, 0)
  assert.equal(selectAutomaticCandidates(master, [curve({manufacturer:'Cherry'})]).length, 0)
  assert.equal(selectAutomaticCandidates(master, [curve({technology:'MAGNETIC'})]).length, 0)
  assert.equal(selectAutomaticCandidates(master, [curve({manufacturer:null, technology:null})]).length, 0)
})
test('exact TG.csv file identity is encoded segment-by-segment', () => assert.equal(catalogUrl('KTT Peach/TG.csv'), 'https://github.com/ThereminGoat/force-curves/blob/main/KTT%20Peach/TG.csv'))
test('approved read supports multiple curves and excludes stale/deleted rows', () => {
  const rows = ['c1','c2'].map(id => ({ state: 'MANUALLY_APPROVED' as const, catalogEntry: { id, displayName: id, repositoryPath: `${id}/TG.csv`, exists: true } }))
  assert.equal(resolveApprovedCurveRecords([...rows, { state: 'STALE', catalogEntry: { id:'c3',displayName:'c3',repositoryPath:'c3/TG.csv',exists:true } }]).length, 2)
  assert.equal(resolveApprovedCurveRecords([{ state: 'AUTO_APPROVED', catalogEntry: { id:'gone',displayName:'gone',repositoryPath:'gone/TG.csv',exists:false } }]).length, 0)
})
test('Peach Blossom behavior: durable NO_MATCH suppresses conflicting approval and yields no TG.csv URL', () => {
  const result = resolveApprovedCurveRecords([{ state: 'NO_MATCH', catalogEntry: null }, { state: 'AUTO_APPROVED', catalogEntry: { id:'bad',displayName:'Cherry Blossom',repositoryPath:'Cherry Blossom/TG.csv',exists:true } }])
  assert.deepEqual(result, []); assert.equal(JSON.stringify(result).includes('TG.csv'), false)
})
