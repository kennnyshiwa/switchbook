// Manufacturer validation utilities

export interface ManufacturerValidationResult {
  isValid: boolean
  verifiedName?: string
  suggestions?: string[]
}

/**
 * Validates manufacturer names against the database
 * @param manufacturers Array of manufacturer names to validate
 * @returns Map of manufacturer name to validation result
 */
export async function validateManufacturers(
  manufacturers: string[]
): Promise<Map<string, ManufacturerValidationResult>> {
  const results = new Map<string, ManufacturerValidationResult>()
  
  // Get unique non-empty manufacturers
  const uniqueManufacturers = [...new Set(manufacturers.filter(m => m && m.trim()))]
  
  if (uniqueManufacturers.length === 0) {
    return results
  }
  
  try {
    // Fetch all verified manufacturers
    const response = await fetch('/api/manufacturers')
    if (!response.ok) {
      throw new Error('Failed to fetch manufacturers')
    }
    
    const verifiedManufacturers = await response.json()
    
    // Create a map for quick lookup
    const manufacturerMap = new Map<string, string>()
    const manufacturerNames = new Set<string>()
    
    verifiedManufacturers.forEach((mfr: any) => {
      manufacturerMap.set(mfr.name.toLowerCase(), mfr.name)
      manufacturerNames.add(mfr.name)
      
      // Also add aliases if available
      if (mfr.aliases && Array.isArray(mfr.aliases)) {
        mfr.aliases.forEach((alias: string) => {
          manufacturerMap.set(alias.toLowerCase(), mfr.name)
        })
      }
    })
    
    // Validate each manufacturer
    for (const manufacturer of uniqueManufacturers) {
      const normalizedName = manufacturer.trim().toLowerCase()
      
      // Check for exact match (case-insensitive)
      const verifiedName = manufacturerMap.get(normalizedName)
      if (verifiedName) {
        results.set(manufacturer, {
          isValid: true,
          verifiedName
        })
        continue
      }
      
      // Check for partial matches for suggestions
      const suggestions: string[] = []
      for (const [key, value] of manufacturerMap) {
        if (key.includes(normalizedName) || normalizedName.includes(key)) {
          if (!suggestions.includes(value)) {
            suggestions.push(value)
          }
        }
      }
      
      results.set(manufacturer, {
        isValid: false,
        suggestions: suggestions.slice(0, 5) // Limit to 5 suggestions
      })
    }
    
    return results
  } catch (error) {
    console.error('Error validating manufacturers:', error)
    // Return all as invalid if there's an error
    for (const manufacturer of uniqueManufacturers) {
      results.set(manufacturer, { isValid: false })
    }
    return results
  }
}

/**
 * Checks if a single manufacturer is valid
 */
export async function isManufacturerValid(manufacturer: string): Promise<boolean> {
  if (!manufacturer || !manufacturer.trim()) {
    return true // Empty is valid (optional field)
  }
  
  const results = await validateManufacturers([manufacturer])
  const result = results.get(manufacturer)
  return result?.isValid ?? false
}