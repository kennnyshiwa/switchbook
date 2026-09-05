import assert from 'node:assert/strict'
import test from 'node:test'
import { performance } from 'node:perf_hooks'
import { readFileSync } from 'node:fs'
import { normalizeCatalogSearch, rankCatalogCandidates, scoreCatalogCandidate, validateSimilarityQuery } from '../src/lib/partner-api/similarity'

const candidate = (id: string, name: string, manufacturer: string | null = 'Gateron', chineseName: string | null = null) => ({ id, name, manufacturer, chineseName })

test('similarity ranking preserves exact, substring, then typo ordering with transparent metadata', () => {
  const ranked = rankCatalogCandidates(normalizeCatalogSearch('Oil King'), [
    candidate('id-c', 'Oil Kign'), candidate('id-b', 'Oil King Pro'), candidate('id-a', 'Oil King'),
  ], 10)
  assert.deepEqual(ranked.map(item => item.match.kind), ['exact', 'substring', 'similar'])
  assert.deepEqual(ranked[0].match.matchedFields, ['name'])
  assert.equal(ranked.every(item => item.match.advisory && item.match.requiresHumanConfirmation), true)
  assert.equal(ranked[0].match.rankScore > ranked[1].match.rankScore, true)
  assert.equal(ranked[1].match.rankScore > ranked[2].match.rankScore, true)
})

test('common manufacturer and full-identity misspellings find likely candidates', () => {
  const maker = scoreCatalogCandidate(normalizeCatalogSearch('Gaterno'), candidate('id-a', 'Oil King'))
  const full = scoreCatalogCandidate(normalizeCatalogSearch('Gateron Oil Kign'), candidate('id-a', 'Oil King'))
  assert.equal(maker?.kind, 'similar')
  assert.deepEqual(maker?.matchedFields, ['manufacturer'])
  assert.equal(full?.kind, 'similar')
  assert.deepEqual(full?.matchedFields, ['manufacturer', 'name'])
})

test('combined manufacturer and name participate in exact and substring tiers', () => {
  assert.equal(scoreCatalogCandidate(normalizeCatalogSearch('Gateron Oil King'), candidate('id-a', 'Oil King'))?.kind, 'exact')
  assert.equal(scoreCatalogCandidate(normalizeCatalogSearch('Gateron Oil'), candidate('id-a', 'Oil King'))?.kind, 'substring')
})

test('negative input yields no candidates and ambiguous ties remain stable multiple results', () => {
  assert.equal(scoreCatalogCandidate(normalizeCatalogSearch('totally unrelated'), candidate('id-a', 'Oil King')), null)
  const ranked = rankCatalogCandidates(normalizeCatalogSearch('Oil Kign'), [
    candidate('switch-z', 'Oil King'), candidate('switch-a', 'Oil King'),
  ], 10)
  assert.deepEqual(ranked.map(item => item.candidate.id), ['switch-a', 'switch-z'])
  assert.equal(ranked.length, 2)
})

test('normalization is Unicode-safe and rejects empty, short, control, term-flood, and oversized queries', () => {
  assert.equal(normalizeCatalogSearch('  ＧÁTERON—油王  '), 'gateron 油王')
  assert.equal(scoreCatalogCandidate(normalizeCatalogSearch('油王'), candidate('id-a', 'Oil King', 'Gateron', '油王'))?.kind, 'exact')
  for (const unsafe of ['', ' ', 'a', '\u0000ab', `${'word '.repeat(25)}end`, '界'.repeat(121)]) {
    assert.equal(validateSimilarityQuery(unsafe).ok, false, JSON.stringify(unsafe))
  }
  assert.equal(validateSimilarityQuery('油王').ok, true)
})

test('production-sized candidate scoring stays bounded and deterministic', () => {
  const candidates = Array.from({ length: 2_700 }, (_, index) => candidate(`id-${String(index).padStart(4, '0')}`, `Catalog Switch ${index}`))
  candidates[2_699] = candidate('id-target', 'Oil King')
  const started = performance.now()
  const first = rankCatalogCandidates(normalizeCatalogSearch('Oil Kign'), candidates, 25)
  const elapsed = performance.now() - started
  const second = rankCatalogCandidates(normalizeCatalogSearch('Oil Kign'), candidates, 25)
  assert.equal(first[0].candidate.id, 'id-target')
  assert.deepEqual(first, second)
  assert.ok(elapsed < 1_000, `scoring took ${elapsed.toFixed(1)}ms`)
  assert.ok(first.length <= 25)
})

test('near-match adversarial maximum-length scoring remains bounded at current catalog size', () => {
  const query = `${'a'.repeat(119)}b`
  const candidates = Array.from({ length: 2_700 }, (_, index) => candidate(
    `id-${String(index).padStart(4, '0')}`, `${'a'.repeat(119)}${index % 2 ? 'c' : 'd'}`, null,
  ))
  const started = performance.now()
  const ranked = rankCatalogCandidates(query, candidates, 25)
  const elapsed = performance.now() - started
  assert.equal(ranked.length, 25)
  assert.ok(elapsed < 1_500, `adversarial scoring took ${elapsed.toFixed(1)}ms`)
})

test('legacy catalog q remains its original case-insensitive substring predicate', () => {
  const source = readFileSync(new URL('../src/app/api/v1/catalog/switches/route.ts', import.meta.url), 'utf8')
  assert.match(source, /name: \{ contains: q, mode: 'insensitive' \}/)
  assert.match(source, /chineseName: \{ contains: q, mode: 'insensitive' \}/)
  assert.match(source, /manufacturer: \{ contains: q, mode: 'insensitive' \}/)
  assert.doesNotMatch(source, /similarity|rankCatalogCandidates/)
})

test('similarity endpoint reuses catalog auth/rate limiting and queries only approved active records in one bounded read', () => {
  const source = readFileSync(new URL('../src/app/api/v1/catalog/switches/similar/route.ts', import.meta.url), 'utf8')
  assert.match(source, /requirePartner\(request, \['catalog:read'\]\)/)
  assert.match(source, /status: MasterSwitchStatus\.APPROVED/)
  assert.match(source, /lifecycle: null[\s\S]*lifecycle: \{ status: 'ACTIVE' \}/)
  assert.match(source, /take: SIMILAR_SEARCH_CANDIDATE_LIMIT \+ 1/)
  assert.equal((source.match(/masterSwitch\.findMany/g) || []).length, 1)
  assert.doesNotMatch(source, /toPartnerSwitch|getApprovedCurves/)
})
