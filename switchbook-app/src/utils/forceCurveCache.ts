import { prisma } from '@/lib/prisma'
import { findAllForceCurveMatches } from './forceCurves'

const CACHE_DURATION_SUCCESS = 1000 * 60 * 60 * 24 * 30 // 30 days for successful lookups
const CACHE_DURATION_FAILURE = 1000 * 60 * 60 * 24 * 7  // 7 days for failed lookups

interface ForceCurveResult {
  hasForceCurve: boolean
  fromCache: boolean
}

/**
 * Check if a switch has force curve data, using database cache to avoid repeated API calls
 */
export async function hasForceCurveDataCached(
  switchName: string, 
  manufacturer?: string
): Promise<ForceCurveResult> {
  const normalizedManufacturer = manufacturer || null
  
  try {
    // Check cache first
    const cached = await prisma.forceCurveCache.findFirst({
      where: {
        switchName,
        manufacturer: normalizedManufacturer
      }
    })

    const now = new Date()
    
    // If we have a cached result and it's still valid
    if (cached) {
      const shouldCheckAgain = cached.nextCheckAt && cached.nextCheckAt <= now
      
      if (!shouldCheckAgain) {
        return {
          hasForceCurve: cached.hasForceCurve,
          fromCache: true
        }
      }
    }

    // Need to check the API
    console.log(`Checking force curves for: ${switchName} (${manufacturer || 'no manufacturer'})`)
    
    const matches = await findAllForceCurveMatches(switchName, manufacturer)
    const hasForceCurve = matches.length > 0
    
    // Calculate next check time based on result
    const nextCheckAt = new Date(now.getTime() + (
      hasForceCurve ? CACHE_DURATION_SUCCESS : CACHE_DURATION_FAILURE
    ))

    // Update or create cache entry
    const existingEntry = await prisma.forceCurveCache.findFirst({
      where: {
        switchName,
        manufacturer: normalizedManufacturer
      }
    })

    if (existingEntry) {
      await prisma.forceCurveCache.update({
        where: { id: existingEntry.id },
        data: {
          hasForceCurve,
          lastCheckedAt: now,
          nextCheckAt,
          updatedAt: now
        }
      })
    } else {
      await prisma.forceCurveCache.create({
        data: {
          switchName,
          manufacturer: normalizedManufacturer,
          hasForceCurve,
          lastCheckedAt: now,
          nextCheckAt
        }
      })
    }

    return {
      hasForceCurve,
      fromCache: false
    }
    
  } catch (error) {
    console.error('Error checking force curve cache:', error)
    
    // Fallback to direct API call if database fails
    try {
      const matches = await findAllForceCurveMatches(switchName, manufacturer)
      return {
        hasForceCurve: matches.length > 0,
        fromCache: false
      }
    } catch (apiError) {
      console.error('Error calling force curve API:', apiError)
      return {
        hasForceCurve: false,
        fromCache: false
      }
    }
  }
}

/**
 * Batch check multiple switches for force curve data
 * More efficient than checking one by one
 */
export async function batchCheckForceCurves(
  switches: Array<{ name: string; manufacturer?: string }>
): Promise<Map<string, boolean>> {
  const results = new Map<string, boolean>()
  
  // Create a consistent key for each switch
  const switchKeys = switches.map(sw => `${sw.name}|${sw.manufacturer || ''}`)
  
  try {
    // Get all cached results at once
    const cached = await prisma.forceCurveCache.findMany({
      where: {
        OR: switches.map(sw => ({
          switchName: sw.name,
          manufacturer: sw.manufacturer || null
        }))
      }
    })
    
    // Build cache lookup map
    const cacheMap = new Map<string, typeof cached[0]>()
    cached.forEach(entry => {
      const key = `${entry.switchName}|${entry.manufacturer || ''}`
      cacheMap.set(key, entry)
    })
    
    const now = new Date()
    const needsCheck: Array<{ name: string; manufacturer?: string; key: string }> = []
    
    // Process each switch
    for (let i = 0; i < switches.length; i++) {
      const sw = switches[i]
      const key = switchKeys[i]
      const cached = cacheMap.get(key)
      
      // Check if cache is valid
      if (cached && (!cached.nextCheckAt || cached.nextCheckAt > now)) {
        results.set(key, cached.hasForceCurve)
      } else {
        needsCheck.push({ ...sw, key })
      }
    }
    
    // Batch check the ones that need API calls
    if (needsCheck.length > 0) {
      console.log(`Batch checking ${needsCheck.length} switches for force curves`)
      
      // Check them in parallel but with some rate limiting
      const BATCH_SIZE = 5 // Check 5 at a time to be nice to GitHub API
      
      for (let i = 0; i < needsCheck.length; i += BATCH_SIZE) {
        const batch = needsCheck.slice(i, i + BATCH_SIZE)
        
        await Promise.all(batch.map(async (sw) => {
          try {
            // Call the API directly, not the cached version to avoid recursion
            const matches = await findAllForceCurveMatches(sw.name, sw.manufacturer)
            const hasForceCurve = matches.length > 0
            
            // Save to cache
            const now = new Date()
            const nextCheckAt = new Date(now.getTime() + (
              hasForceCurve ? CACHE_DURATION_SUCCESS : CACHE_DURATION_FAILURE
            ))
            
            const normalizedManufacturer = sw.manufacturer || null
            
            // Update or create cache entry
            // Try to create first, if it fails due to unique constraint, update instead
            try {
              await prisma.forceCurveCache.create({
                data: {
                  switchName: sw.name,
                  manufacturer: normalizedManufacturer,
                  hasForceCurve,
                  lastCheckedAt: now,
                  nextCheckAt
                }
              })
            } catch (error: any) {
              if (error.code === 'P2002') {
                // Unique constraint violation - record already exists, update it
                await prisma.forceCurveCache.updateMany({
                  where: {
                    switchName: sw.name,
                    manufacturer: normalizedManufacturer
                  },
                  data: {
                    hasForceCurve,
                    lastCheckedAt: now,
                    nextCheckAt,
                    updatedAt: now
                  }
                })
              } else {
                throw error
              }
            }
            
            results.set(sw.key, hasForceCurve)
          } catch (error) {
            console.error(`Error checking ${sw.name}:`, error)
            results.set(sw.key, false)
          }
        }))
        
        // Small delay between batches
        if (i + BATCH_SIZE < needsCheck.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
    }
    
  } catch (error) {
    console.error('Error in batch force curve check:', error)
    
    // Fallback: mark all as false
    switchKeys.forEach(key => {
      if (!results.has(key)) {
        results.set(key, false)
      }
    })
  }
  
  return results
}

/**
 * Clear cache entries that should be rechecked (for admin/maintenance)
 */
export async function clearExpiredForceCurveCache(): Promise<number> {
  const now = new Date()
  
  const result = await prisma.forceCurveCache.deleteMany({
    where: {
      nextCheckAt: {
        lte: now
      }
    }
  })
  
  return result.count
}

/**
 * Get cache statistics (for admin/debugging)
 */
export async function getForceCurveCacheStats() {
  const total = await prisma.forceCurveCache.count()
  const withForceCurves = await prisma.forceCurveCache.count({
    where: { hasForceCurve: true }
  })
  const needsRecheck = await prisma.forceCurveCache.count({
    where: {
      nextCheckAt: {
        lte: new Date()
      }
    }
  })
  
  return {
    total,
    withForceCurves,
    withoutForceCurves: total - withForceCurves,
    needsRecheck
  }
}