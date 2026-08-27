import test from 'node:test'
import assert from 'node:assert/strict'
import { applySwitchFilters, deriveSwitchFilterOptions, normalizeFilterValue } from '../src/lib/switch-filters'

const records = [
  { manufacturer: '  Gateron ', type: 'LINEAR', technology: 'MECHANICAL', topHousing: 'Polycarbonate', actuationForce: 45, progressiveSpring: false },
  { manufacturer: 'gateron', type: 'TACTILE', technology: 'MECHANICAL', topHousing: ' Nylon  Blend ', actuationForce: 55, progressiveSpring: true },
  { manufacturer: 'Cherry', type: 'LINEAR', technology: 'OPTICAL', topHousing: 'Nylon Blend', actuationForce: 60, progressiveSpring: false },
]

test('filter values normalize whitespace and case', () => {
  assert.equal(normalizeFilterValue('  Nylon   Blend '), 'nylon blend')
})

test('options derive only from real values and are normalized, deduplicated, and sorted', () => {
  const options = deriveSwitchFilterOptions(records)
  assert.deepEqual(options.manufacturers, ['Cherry', 'Gateron'])
  assert.deepEqual(options.topHousings, ['Nylon Blend', 'Polycarbonate'])
  assert.deepEqual(options.actuationForces, [45, 55, 60])
  assert.deepEqual(options.progressiveSprings, [false, true])
})

test('single and combined categorical filters use normalized exact matching', () => {
  assert.equal(applySwitchFilters(records, { manufacturer: 'GATERON' }).length, 2)
  assert.deepEqual(applySwitchFilters(records, { manufacturer: 'Gateron', type: 'TACTILE' }), [records[1]])
  assert.deepEqual(applySwitchFilters(records, { topHousing: 'nylon blend', technology: 'OPTICAL' }), [records[2]])
})

test('ranges and booleans combine and no-result filters reset cleanly', () => {
  assert.deepEqual(applySwitchFilters(records, { actuationForceMin: 50, actuationForceMax: 58, progressiveSpring: true }), [records[1]])
  assert.deepEqual(applySwitchFilters(records, { manufacturer: 'missing' }), [])
  assert.deepEqual(applySwitchFilters(records, {}), records)
})
