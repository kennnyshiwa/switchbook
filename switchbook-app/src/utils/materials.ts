// Cached materials for client-side usage
let materialsCache: { id: string; name: string }[] | null = null
let cacheTimestamp: number = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export async function getMaterials(): Promise<{ id: string; name: string }[]> {
  // Check if cache is valid
  if (materialsCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return materialsCache
  }

  try {
    const response = await fetch('/api/materials')
    if (!response.ok) {
      throw new Error('Failed to fetch materials')
    }
    
    const materials = await response.json()
    materialsCache = materials
    cacheTimestamp = Date.now()
    
    return materials
  } catch (error) {
    console.error('Error fetching materials:', error)
    // Return default materials if fetch fails
    return getDefaultMaterials()
  }
}

export function getDefaultMaterials() {
  return [
    { id: 'PA66', name: 'PA66' },
    { id: 'Nylon', name: 'Nylon' },
    { id: 'Polycarbonate', name: 'Polycarbonate' },
    { id: 'POK', name: 'POK' },
    { id: 'HPE', name: 'HPE' },
    { id: 'UHMWPE', name: 'UHMWPE' },
    { id: 'POM', name: 'POM' }
  ]
}

// Clear cache when needed
export function clearMaterialsCache() {
  materialsCache = null
  cacheTimestamp = 0
}