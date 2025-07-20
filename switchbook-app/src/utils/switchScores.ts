// Switch scores integration with ThereminGoat repository
const SWITCH_SCORES_REPO = 'ThereminGoat/switch-scores'
const GITHUB_API_BASE = 'https://api.github.com'

interface GitHubContent {
  name: string
  path: string
  sha: string
  size: number
  url: string
  html_url: string
  git_url: string
  download_url: string | null
  type: 'file' | 'dir'
}

// Cache for switch score files to avoid repeated API calls
let switchScoresCache: string[] | null = null
let cacheTimestamp: number | null = null
const CACHE_DURATION = 1000 * 60 * 60 // 1 hour

/**
 * Fetch all switch score markdown files from the ThereminGoat repository
 */
export async function fetchSwitchScoreFiles(): Promise<string[]> {
  // Return cached data if still valid
  if (switchScoresCache && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return switchScoresCache
  }

  try {
    const response = await fetch(
      `${GITHUB_API_BASE}/repos/${SWITCH_SCORES_REPO}/contents`,
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

    const data: GitHubContent[] = await response.json()
    
    // Extract PDF files that are switch scorecards
    const files = data
      .filter(item => 
        item.type === 'file' && 
        item.name.endsWith('.pdf')
      )
      .map(item => item.name.replace('.pdf', ''))
      .sort()

    // Update cache
    switchScoresCache = files
    cacheTimestamp = Date.now()

    return files
  } catch (error) {
    console.error('Failed to fetch switch score files:', error)
    return switchScoresCache || [] // Return cached data if available, empty array otherwise
  }
}

export interface SwitchScoreMatch {
  fileName: string
  url: string
  matchType: 'exact' | 'manufacturer-exact' | 'fuzzy' | 'manufacturer-fuzzy'
}

/**
 * Get reported incorrect matches for a switch
 * TODO: Implement this with proper caching/batching like force curves
 */
async function getIncorrectMatches(switchName: string, manufacturer?: string): Promise<Set<string>> {
  // For now, return empty set to avoid 404 errors
  // This will be implemented with proper caching/batching in the future
  return new Set<string>()
}

/**
 * Find all matching switch score data for a given switch
 */
export async function findAllSwitchScoreMatches(switchName: string, manufacturer?: string): Promise<SwitchScoreMatch[]> {
  try {
    const files = await fetchSwitchScoreFiles()
    const matches: SwitchScoreMatch[] = []
    
    const switchLower = switchName.toLowerCase()
    const manufacturerLower = manufacturer?.toLowerCase()

    // 1. Exact matches
    files.forEach(file => {
      if (file.toLowerCase() === switchLower) {
        matches.push({
          fileName: file,
          url: `https://github.com/${SWITCH_SCORES_REPO}/blob/master/${encodeURIComponent(file)}.pdf`,
          matchType: 'exact'
        })
      }
    })

    // 2. Manufacturer + name exact matches
    if (manufacturer) {
      files.forEach(file => {
        const fileLower = file.toLowerCase()
        if (fileLower === `${manufacturerLower} ${switchLower}`) {
          // Avoid duplicates from exact match
          if (!matches.some(m => m.fileName === file)) {
            matches.push({
              fileName: file,
              url: `https://github.com/${SWITCH_SCORES_REPO}/blob/master/${encodeURIComponent(file)}.pdf`,
              matchType: 'manufacturer-exact'
            })
          }
        }
      })
    }

    // 3. Manufacturer-specific fuzzy matching (prioritize these over generic fuzzy)
    if (manufacturer) {
      files.forEach(file => {
        const fileLower = file.toLowerCase()
        
        // Skip if already matched
        if (matches.some(m => m.fileName === file)) return
        
        // Check if file starts with manufacturer and contains switch name parts
        if (fileLower.startsWith(manufacturerLower!)) {
          // Remove manufacturer from file name for comparison
          const fileWithoutManufacturer = fileLower.replace(manufacturerLower!, '').trim()
          const switchWithoutManufacturer = switchLower.replace(manufacturerLower!, '').trim()
          
          // Check if the remaining parts match
          if (fileWithoutManufacturer.includes(switchWithoutManufacturer) || 
              switchWithoutManufacturer.includes(fileWithoutManufacturer)) {
            matches.push({
              fileName: file,
              url: `https://github.com/${SWITCH_SCORES_REPO}/blob/master/${encodeURIComponent(file)}.pdf`,
              matchType: 'manufacturer-fuzzy'
            })
          }
        }
      })
    }

    // 4. Generic fuzzy matches (only if no manufacturer specified AND no matches found)
    if (!manufacturer && matches.length === 0) {
      files.forEach(file => {
        const fileLower = file.toLowerCase()
        
        // Skip if already matched
        if (matches.some(m => m.fileName === file)) return
        
        // For generic fuzzy matching, be more strict:
        // - File name should contain most of the switch name words
        // - Or switch name should contain most of the file name words
        const switchWords = switchLower.split(/\s+/).filter(w => w.length > 2) // Ignore short words
        const fileWords = fileLower.split(/\s+/).filter(w => w.length > 2)
        
        // Check if most switch words are in file name
        const switchWordsInFile = switchWords.filter(word => fileLower.includes(word))
        const fileWordsInSwitch = fileWords.filter(word => switchLower.includes(word))
        
        // Require at least 70% of words to match
        if ((switchWords.length > 0 && switchWordsInFile.length / switchWords.length >= 0.7) ||
            (fileWords.length > 0 && fileWordsInSwitch.length / fileWords.length >= 0.7)) {
          matches.push({
            fileName: file,
            url: `https://github.com/${SWITCH_SCORES_REPO}/blob/master/${encodeURIComponent(file)}.pdf`,
            matchType: 'fuzzy'
          })
        }
      })
    }

    // Sort by match quality (exact first, then manufacturer-exact, etc.)
    return matches.sort((a, b) => {
      const order = { exact: 0, 'manufacturer-exact': 1, 'manufacturer-fuzzy': 2, fuzzy: 3 }
      return order[a.matchType] - order[b.matchType]
    })

  } catch (error) {
    console.error('Error finding switch score matches:', error)
    return []
  }
}

/**
 * Find switch score data for a given switch (backwards compatibility)
 */
export async function findSwitchScoreData(switchName: string, manufacturer?: string): Promise<string | null> {
  const matches = await findAllSwitchScoreMatches(switchName, manufacturer)
  return matches.length > 0 ? matches[0].url : null
}

/**
 * Check if switch score data is available for a switch (for quick checks)
 */
export async function hasSwitchScoreData(switchName: string, manufacturer?: string): Promise<boolean> {
  const result = await findSwitchScoreData(switchName, manufacturer)
  return result !== null
}

/**
 * Get all available switch names from scorecards (for development/debugging)
 */
export async function getAllSwitchScoreNames(): Promise<string[]> {
  return await fetchSwitchScoreFiles()
}