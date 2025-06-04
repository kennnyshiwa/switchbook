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

/**
 * Find force curve data for a given switch
 */
export async function findForceCurveData(switchName: string, manufacturer?: string): Promise<string | null> {
  try {
    const folders = await fetchSwitchFolders()
    
    // Try exact match first
    const exactMatch = folders.find(folder => 
      folder.toLowerCase() === switchName.toLowerCase()
    )
    if (exactMatch) {
      return `https://github.com/${FORCE_CURVES_REPO}/tree/main/${encodeURIComponent(exactMatch)}`
    }

    // Try with manufacturer prefix if provided
    if (manufacturer) {
      const withManufacturer = folders.find(folder => 
        folder.toLowerCase() === `${manufacturer.toLowerCase()} ${switchName.toLowerCase()}`
      )
      if (withManufacturer) {
        return `https://github.com/${FORCE_CURVES_REPO}/tree/main/${encodeURIComponent(withManufacturer)}`
      }
    }

    // Try fuzzy matching - switch name contains folder name or vice versa
    const fuzzyMatch = folders.find(folder => {
      const folderLower = folder.toLowerCase()
      const switchLower = switchName.toLowerCase()
      
      // Check if switch name contains the folder name or vice versa
      return folderLower.includes(switchLower) || switchLower.includes(folderLower)
    })
    
    if (fuzzyMatch) {
      return `https://github.com/${FORCE_CURVES_REPO}/tree/main/${encodeURIComponent(fuzzyMatch)}`
    }

    // Try manufacturer-specific fuzzy matching
    if (manufacturer) {
      const manufacturerFuzzy = folders.find(folder => {
        const folderLower = folder.toLowerCase()
        const manufacturerLower = manufacturer.toLowerCase()
        const switchLower = switchName.toLowerCase()
        
        // Check if folder starts with manufacturer and contains switch name
        return folderLower.startsWith(manufacturerLower) && 
               (folderLower.includes(switchLower) || switchLower.includes(folderLower.replace(manufacturerLower, '').trim()))
      })
      
      if (manufacturerFuzzy) {
        return `https://github.com/${FORCE_CURVES_REPO}/tree/main/${encodeURIComponent(manufacturerFuzzy)}`
      }
    }

    return null
  } catch (error) {
    console.error('Error finding force curve data:', error)
    return null
  }
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