export const SIMILAR_SEARCH_CANDIDATE_LIMIT = 5_000
export const SIMILAR_SEARCH_QUERY_MAX_CODE_POINTS = 120

export type SimilarityField = 'name' | 'chineseName' | 'manufacturer'
export type SimilarityKind = 'exact' | 'substring' | 'similar'

export type SimilarityCandidate = {
  id: string
  name: string
  chineseName: string | null
  manufacturer: string | null
}

export type SimilarityMatch = {
  kind: SimilarityKind
  matchedFields: SimilarityField[]
  rankScore: number
  explanation: string
  advisory: true
  requiresHumanConfirmation: true
}

const compareStable = (left: string, right: string) => left < right ? -1 : left > right ? 1 : 0

export function normalizeCatalogSearch(value: string) {
  return value.normalize('NFKD').replace(/\p{M}+/gu, '').toLocaleLowerCase('und')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/gu, ' ')
}

export function validateSimilarityQuery(value: string) {
  const trimmed = value.trim()
  const codePoints = [...trimmed]
  if (codePoints.length > SIMILAR_SEARCH_QUERY_MAX_CODE_POINTS) return { ok: false as const, reason: 'Query must be at most 120 Unicode characters' }
  if (codePoints.some(char => /[\p{Cc}\p{Cf}\p{Cs}]/u.test(char))) return { ok: false as const, reason: 'Query contains unsafe control or formatting characters' }
  const normalized = normalizeCatalogSearch(trimmed)
  if ([...normalized].length < 2) return { ok: false as const, reason: 'Query must contain at least two searchable characters' }
  if (normalized.split(' ').length > 24) return { ok: false as const, reason: 'Query contains too many terms' }
  return { ok: true as const, value: trimmed, normalized }
}

function boundedDamerauLevenshtein(left: string, right: string, maximum: number) {
  const a = [...left]
  const b = [...right]
  if (Math.abs(a.length - b.length) > maximum) return maximum + 1
  let previousPrevious: number[] | null = null
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    let rowMinimum = current[0]
    for (let j = 1; j <= b.length; j++) {
      const substitution = previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, substitution)
      if (previousPrevious && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, previousPrevious[j - 2] + 1)
      }
      current[j] = value
      rowMinimum = Math.min(rowMinimum, value)
    }
    if (rowMinimum > maximum) return maximum + 1
    previousPrevious = previous
    previous = current
  }
  return previous[b.length]
}

function typoScore(query: string, candidate: string) {
  const queryLength = [...query].length
  const candidateLength = [...candidate].length
  const longest = Math.max(queryLength, candidateLength)
  if (!longest || Math.min(queryLength, candidateLength) < 2) return null
  const maximum = Math.min(6, Math.max(1, Math.floor(longest * 0.28)))
  const distance = boundedDamerauLevenshtein(query, candidate, maximum)
  if (distance > maximum) return null
  const similarity = 1 - distance / longest
  if (similarity < (longest <= 4 ? 0.74 : 0.68)) return null
  return Math.round(similarity * 800) + Math.min(99, longest)
}

function fieldEntries(candidate: SimilarityCandidate) {
  return ([
    ['name', candidate.name],
    ['chineseName', candidate.chineseName],
    ['manufacturer', candidate.manufacturer],
  ] as const).filter((entry): entry is [SimilarityField, string] => Boolean(entry[1]))
    .map(([field, value]) => ({ field, value: normalizeCatalogSearch(value).slice(0, 240) }))
    .filter(entry => entry.value.length > 0)
}

export function scoreCatalogCandidate(normalizedQuery: string, candidate: SimilarityCandidate): SimilarityMatch | null {
  const fields = fieldEntries(candidate)
  const searchable = [
    ...fields.map(field => ({ fields: [field.field], value: field.value })),
    ...(candidate.manufacturer ? [{
      fields: ['manufacturer', 'name'] as SimilarityField[],
      value: normalizeCatalogSearch(`${candidate.manufacturer} ${candidate.name}`).slice(0, 240),
    }] : []),
  ]
  const exact = searchable.find(entry => entry.value === normalizedQuery)
  if (exact) return {
    kind: 'exact', matchedFields: exact.fields, rankScore: 3_000,
    explanation: `Normalized query exactly matches ${exact.fields.join(' and ')}`,
    advisory: true, requiresHumanConfirmation: true,
  }

  const substrings = searchable.filter(entry => entry.value.includes(normalizedQuery))
  if (substrings.length) {
    const best = substrings.sort((left, right) => [...left.value].length - [...right.value].length || compareStable(left.fields.join(','), right.fields.join(',')))[0]
    return {
      kind: 'substring', matchedFields: best.fields,
      rankScore: 2_000 + Math.max(0, 500 - Math.max(0, [...best.value].length - [...normalizedQuery].length)),
      explanation: `Normalized query is a substring of ${best.fields.join(' and ')}`,
      advisory: true, requiresHumanConfirmation: true,
    }
  }

  const scored = searchable.map(entry => ({ ...entry, score: typoScore(normalizedQuery, entry.value) }))
    .filter((entry): entry is typeof entry & { score: number } => entry.score !== null)
    .sort((a, b) => b.score - a.score || compareStable(a.fields.join(','), b.fields.join(',')))
  const best = scored[0]
  if (!best) return null
  return {
    kind: 'similar', matchedFields: best.fields, rankScore: 1_000 + best.score,
    explanation: `Normalized spelling is close to ${best.fields.join(' and ')}; review all returned candidates`,
    advisory: true, requiresHumanConfirmation: true,
  }
}

export function rankCatalogCandidates(normalizedQuery: string, candidates: SimilarityCandidate[], limit: number) {
  return candidates.flatMap(candidate => {
    const match = scoreCatalogCandidate(normalizedQuery, candidate)
    return match ? [{ candidate, match }] : []
  }).sort((left, right) => right.match.rankScore - left.match.rankScore || compareStable(left.candidate.id, right.candidate.id))
    .slice(0, limit)
}
