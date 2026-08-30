export const FORCE_CURVE_RANK_ALGORITHM = 'rank-v1' as const

export type RankMaster = { id: string; name: string; manufacturer: string | null; technology: string | null }
export type RankCatalog = { id: string; displayName: string; repositoryPath: string; manufacturer: string | null; technology: string | null }
export type RankSuggestion = {
  algorithm: typeof FORCE_CURVE_RANK_ALGORITHM
  tier: 'EXACT_UNIQUE' | 'BOUNDARY_UNIQUE'
  reason: 'NORMALIZED_IDENTITY_EXACT' | 'FULL_IDENTITY_BOUNDARY'
  master: RankMaster
  warnings: string[]
}

export function normalizeForceCurveIdentity(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ')
}

function identities(catalog: RankCatalog) {
  const folder = catalog.repositoryPath.split('/')[0] || ''
  return [...new Set([catalog.displayName, folder].map(normalizeForceCurveIdentity).filter(Boolean))]
}

function masterIdentities(master: RankMaster) {
  return [...new Set([master.name, `${master.manufacturer || ''} ${master.name}`].map(normalizeForceCurveIdentity).filter(Boolean))]
}

function isFullBoundary(haystack: string, needle: string) {
  return needle.length >= 5 && ` ${haystack} `.includes(` ${needle} `)
}

export function rankForceCurveSuggestion(catalog: RankCatalog, masters: RankMaster[], overflow = false): RankSuggestion | null {
  if (overflow || !catalog.id || !catalog.repositoryPath || !catalog.displayName) return null
  const source = identities(catalog)
  const ranked: { master: RankMaster; tier: 1 | 2 }[] = []
  for (const master of masters) {
    const target = masterIdentities(master)
    const exact = source.some(left => target.some(right => left === right))
    // Boundary tier requires the full manufacturer + product identity. Bare
    // product-name containment is the rejected threshold-80 rule.
    const fullIdentity = master.manufacturer ? normalizeForceCurveIdentity(`${master.manufacturer} ${master.name}`) : ''
    const boundary = !exact && !!fullIdentity && source.some(left => isFullBoundary(left, fullIdentity) || isFullBoundary(fullIdentity, left))
    if (exact) ranked.push({ master, tier: 2 })
    else if (boundary) ranked.push({ master, tier: 1 })
  }
  const bestTier = Math.max(0, ...ranked.map(value => value.tier))
  const best = ranked.filter(value => value.tier === bestTier)
  // A lexical tie is an identity ambiguity, not an invitation to guess.
  if (!bestTier || best.length !== 1) return null
  const { master } = best[0]
  const warnings = [
    !catalog.manufacturer || !master.manufacturer ? 'Manufacturer metadata is incomplete; verify the grouped source evidence.' : normalizeForceCurveIdentity(catalog.manufacturer) !== normalizeForceCurveIdentity(master.manufacturer) ? 'Manufacturer metadata differs; the server may reject this attachment.' : '',
    !catalog.technology || !master.technology ? 'Technology metadata is incomplete; verify the switch technology.' : catalog.technology !== master.technology ? 'Technology differs; the server will require explicit compatibility handling.' : '',
  ].filter(Boolean)
  return {
    algorithm: FORCE_CURVE_RANK_ALGORITHM,
    tier: bestTier === 2 ? 'EXACT_UNIQUE' : 'BOUNDARY_UNIQUE',
    reason: bestTier === 2 ? 'NORMALIZED_IDENTITY_EXACT' : 'FULL_IDENTITY_BOUNDARY',
    master,
    warnings,
  }
}
