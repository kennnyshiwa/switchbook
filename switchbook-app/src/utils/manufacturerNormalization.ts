import { prisma } from '@/lib/prisma'
import { sendNewManufacturerNotification } from '@/lib/email'

/**
 * Normalizes manufacturer name to the proper capitalization and spelling
 * from the manufacturers table. Returns the canonical name if found,
 * creates a new manufacturer entry if not found, and sends notification to admins.
 */
export async function normalizeManufacturerName(
  manufacturerName: string, 
  userId?: string,
  userInfo?: { username: string; email?: string }
): Promise<string> {
  if (!manufacturerName || !manufacturerName.trim()) {
    return manufacturerName
  }

  try {
    const trimmedName = manufacturerName.trim()
    console.log(`[Manufacturer Normalization] Processing: "${trimmedName}"`)
    
    // Get all manufacturers with their names and aliases
    const manufacturers = await prisma.manufacturer.findMany({
      select: {
        name: true,
        aliases: true
      }
    })
    
    console.log(`[Manufacturer Normalization] Checking against ${manufacturers.length} existing manufacturers`)

    // Check for exact match (case-insensitive) with manufacturer name or aliases
    for (const manufacturer of manufacturers) {
      // Check canonical name
      if (manufacturer.name.toLowerCase() === trimmedName.toLowerCase()) {
        console.log(`[Manufacturer Normalization] Found exact match: "${manufacturer.name}"`)
        return manufacturer.name
      }
      
      // Check aliases
      if (manufacturer.aliases) {
        for (const alias of manufacturer.aliases) {
          if (alias.toLowerCase() === trimmedName.toLowerCase()) {
            console.log(`[Manufacturer Normalization] Found alias match: "${alias}" -> "${manufacturer.name}"`)
            return manufacturer.name
          }
        }
      }
    }
    
    console.log(`[Manufacturer Normalization] No match found, creating new manufacturer`)

    // If no match found, create a new manufacturer entry (unverified)
    // Normalize the name: capitalize first letter of each word
    const normalizedName = trimmedName
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
    
    console.log(`Creating new manufacturer: ${normalizedName}${normalizedName !== trimmedName ? ` (normalized from: ${trimmedName})` : ''}`)
    
    try {
      const newManufacturer = await prisma.manufacturer.create({
        data: {
          name: normalizedName,
          verified: false,
          aliases: []
        }
      })

      // Get user info for notification if not provided
      let submittedBy = 'Unknown User'
      let userEmail: string | undefined

      if (userInfo) {
        submittedBy = userInfo.username
        userEmail = userInfo.email
      } else if (userId) {
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { username: true, email: true }
        })
        if (user) {
          submittedBy = user.username
          userEmail = user.email
        }
      }

      // Send notification to admins (don't block on email failure)
      sendNewManufacturerNotification(
        normalizedName, 
        submittedBy, 
        userEmail, 
        normalizedName !== trimmedName ? trimmedName : undefined
      )
        .then((result) => {
          if (result.success) {
            console.log(`Admin notification sent for new manufacturer: ${normalizedName}`)
          } else {
            console.warn(`Failed to send admin notification for new manufacturer: ${normalizedName}`, result.error)
          }
        })
        .catch((error) => {
          console.error(`Error sending admin notification for new manufacturer: ${normalizedName}`, error)
        })

      return newManufacturer.name
    } catch (createError) {
      // Handle potential race condition where another request created the same manufacturer
      if (createError && typeof createError === 'object' && 'code' in createError && createError.code === 'P2002') {
        console.log(`Manufacturer ${normalizedName} was created by another request, fetching...`)
        const existingManufacturer = await prisma.manufacturer.findFirst({
          where: { name: { equals: normalizedName, mode: 'insensitive' } }
        })
        return existingManufacturer?.name || normalizedName
      }
      throw createError
    }
  } catch (error) {
    console.error('Error normalizing manufacturer name:', error)
    // If there's an error, return the original name
    return manufacturerName.trim()
  }
}