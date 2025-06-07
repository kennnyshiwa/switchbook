import { prisma } from '@/lib/prisma'

/**
 * Normalizes manufacturer name to the proper capitalization and spelling
 * from the manufacturers table. Returns the canonical name if found,
 * otherwise returns the original name.
 */
export async function normalizeManufacturerName(manufacturerName: string): Promise<string> {
  if (!manufacturerName || !manufacturerName.trim()) {
    return manufacturerName
  }

  try {
    const trimmedName = manufacturerName.trim()
    
    // Get all manufacturers with their names and aliases
    const manufacturers = await prisma.manufacturer.findMany({
      select: {
        name: true,
        aliases: true
      }
    })

    // Check for exact match (case-insensitive) with manufacturer name or aliases
    for (const manufacturer of manufacturers) {
      // Check canonical name
      if (manufacturer.name.toLowerCase() === trimmedName.toLowerCase()) {
        return manufacturer.name
      }
      
      // Check aliases
      if (manufacturer.aliases) {
        for (const alias of manufacturer.aliases) {
          if (alias.toLowerCase() === trimmedName.toLowerCase()) {
            return manufacturer.name
          }
        }
      }
    }

    // If no match found, return the original name (trimmed)
    return trimmedName
  } catch (error) {
    console.error('Error normalizing manufacturer name:', error)
    // If there's an error, return the original name
    return manufacturerName.trim()
  }
}