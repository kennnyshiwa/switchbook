// Cached stem shapes for client-side usage
let stemShapesCache: { id: string; name: string }[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getStemShapes(): Promise<{ id: string; name: string }[]> {
  // Check if cache is valid
  if (stemShapesCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return stemShapesCache
  }

  try {
    const response = await fetch('/api/stem-shapes')
    if (!response.ok) {
      throw new Error('Failed to fetch stem shapes')
    }
    
    const stemShapes = await response.json()
    stemShapesCache = stemShapes
    cacheTimestamp = Date.now()
    
    return stemShapes
  } catch (error) {
    console.error('Error fetching stem shapes:', error)
    // Return default stem shapes if fetch fails
    return getDefaultStemShapes()
  }
}

export function getDefaultStemShapes() {
  return [
    { id: 'Dustproof', name: 'Dustproof' },
    { id: 'Box', name: 'Box' },
    { id: 'MX', name: 'MX' },
    { id: 'Alps', name: 'Alps' },
    { id: 'Mitsumi', name: 'Mitsumi' }
  ]
}

// Clear cache when needed
export function clearStemShapesCache() {
  stemShapesCache = null
  cacheTimestamp = 0
}