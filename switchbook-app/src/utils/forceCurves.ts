// Force curves integration with ThereminGoat repository
const FORCE_CURVES_REPO = 'ThereminGoat/force-curves'
const GITHUB_API_BASE = 'https://api.github.com'

interface GitHubTreeItem {
  path: string
  type: 'tree' | 'blob'
  sha: string
  url: string
}

interface GitHubTreeResponse {
  tree: GitHubTreeItem[]
  truncated: boolean
}

// Cache for switch folders to avoid repeated API calls
let switchFoldersCache: string[] | null = null
let cacheTimestamp: number | null = null
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

/**
 * Fetch all switch folder names from the ThereminGoat repository
 */
export async function fetchSwitchFolders(): Promise<string[]> {
  // Return cached data if still valid
  if (switchFoldersCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return switchFoldersCache
  }

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${FORCE_CURVES_REPO}/git/trees/main?recursive=1`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Switchbook-App'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status}`)
    }

    const data: GitHubTreeResponse = await response.json()
    
    // Extract folder names (directories that are direct children of root)
    const folders = data.tree
      .filter(item => item.type === 'tree' && !item.path.includes('/'))
      .map(item => item.path)
      .sort()

    // Update cache
    switchFoldersCache = folders
    cacheTimestamp = Date.now()

    return folders
  } catch (error) {
    console.error('Failed to fetch switch folders:', error)
    return switchFoldersCache || [] // Return cached data if available, empty array otherwise
  }
}

export interface ForceCurveMatch {
  folderName: string
  url: string
  matchType: 'exact' | 'manufacturer-exact' | 'fuzzy' | 'manufacturer-fuzzy'
}

/**
 * Find all matching force curve data for a given switch
 */
export async function findAllForceCurveMatches(switchName: string, manufacturer?: string): Promise<ForceCurveMatch[]> {
  try {
    const folders = await fetchSwitchFolders()
    const matches: ForceCurveMatch[] = []
    
    const switchLower = switchName.toLowerCase()
    const manufacturerLower = manufacturer?.toLowerCase()

    // 1. Exact matches
    folders.forEach(folder => {
      if (folder.toLowerCase() === switchLower) {
        matches.push({
          folderName: folder,
          url: `https://github.com/${FORCE_CURVES_REPO}/tree/main/${encodeURIComponent(folder)}`,
          matchType: 'exact'
        })
      }
    })

    // 2. Manufacturer + name exact matches
    if (manufacturer) {
      folders.forEach(folder => {
        const folderLower = folder.toLowerCase()
        if (folderLower === `${manufacturerLower} ${switchLower}`) {
          // Avoid duplicates from exact match
          if (!matches.some(m => m.folderName === folder)) {
            matches.push({
              folderName: folder,
              url: `https://github.com/${FORCE_CURVES_REPO}/tree/main/${encodeURIComponent(folder)}`,
              matchType: 'manufacturer-exact'
            })
          }
        }
      })
    }

    // 3. Fuzzy matches (contains search term)
    folders.forEach(folder => {
      const folderLower = folder.toLowerCase()
      
      // Skip if already matched exactly
      if (matches.some(m => m.folderName === folder)) return
      
      // Check if switch name contains folder name or vice versa
      if (folderLower.includes(switchLower) || switchLower.includes(folderLower)) {
        matches.push({
          folderName: folder,
          url: `https://github.com/${FORCE_CURVES_REPO}/tree/main/${encodeURIComponent(folder)}`,
          matchType: 'fuzzy'
        })
      }
    })

    // 4. Manufacturer-specific fuzzy matching
    if (manufacturer) {
      folders.forEach(folder => {
        const folderLower = folder.toLowerCase()
        
        // Skip if already matched
        if (matches.some(m => m.folderName === folder)) return
        
        // Check if folder starts with manufacturer and contains switch name
        if (folderLower.startsWith(manufacturerLower!) && 
            (folderLower.includes(switchLower) || switchLower.includes(folderLower.replace(manufacturerLower!, '').trim()))) {
          matches.push({
            folderName: folder,
            url: `https://github.com/${FORCE_CURVES_REPO}/tree/main/${encodeURIComponent(folder)}`,
            matchType: 'manufacturer-fuzzy'
          })
        }
      })
    }

    // Sort by match quality (exact first, then manufacturer-exact, etc.)
    return matches.sort((a, b) => {
      const order = { exact: 0, 'manufacturer-exact': 1, fuzzy: 2, 'manufacturer-fuzzy': 3 }
      return order[a.matchType] - order[b.matchType]
    })

  } catch (error) {
    console.error('Error finding force curve matches:', error)
    return []
  }
}

/**
 * Find force curve data for a given switch (backwards compatibility)
 */
export async function findForceCurveData(switchName: string, manufacturer?: string): Promise<string | null> {
  const matches = await findAllForceCurveMatches(switchName, manufacturer)
  return matches.length > 0 ? matches[0].url : null
}

/**
 * Check if force curve data is available for a switch (for quick checks)
 */
export async function hasForceCurveData(switchName: string, manufacturer?: string): Promise<boolean> {
  const result = await findForceCurveData(switchName, manufacturer)
  return result !== null
}

/**
 * Get all available switch names (for development/debugging)
 */
export async function getAllSwitchNames(): Promise<string[]> {
  return await fetchSwitchFolders()
}