import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { switchSchema } from "@/lib/validation"
import { z } from "zod"
import { transformSwitchData } from "@/utils/dataTransform"
import { normalizeManufacturerName } from "@/utils/manufacturerNormalization"
import { BulkOperationMonitor } from "@/lib/performance-monitor"

// Configuration for bulk operations  
const BULK_CONFIG = {
  MAX_SWITCHES_PER_REQUEST: 500, // Process up to 500 switches per API call (increased for better bulk performance)
  MAX_TOTAL_SWITCHES_PER_USER: 25000, // Increased limit for serious collectors
  PROCESSING_DELAY_MS: 10, // Minimal delay - just enough to prevent overwhelming DB
  MAX_CONCURRENT_OPERATIONS: 3, // Allow up to 3 concurrent bulk operations
}

// Track active bulk operations per user
const activeBulkOperations = new Map<string, number>()

const bulkSwitchSchema = z.object({
  switches: z.array(switchSchema).max(BULK_CONFIG.MAX_SWITCHES_PER_REQUEST, 
    `Maximum ${BULK_CONFIG.MAX_SWITCHES_PER_REQUEST} switches per request`),
  batchId: z.string().optional(), // For tracking multi-batch uploads
})

async function bulkCreateHandler(request: NextRequest) {
  let monitor: BulkOperationMonitor | null = null
  
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const userId = session.user.id

    // Check if user has too many active bulk operations (for system stability)
    const activeOps = activeBulkOperations.get(userId) || 0
    if (activeOps >= BULK_CONFIG.MAX_CONCURRENT_OPERATIONS) {
      return NextResponse.json(
        { 
          error: `You have ${activeOps} bulk operations in progress. Please wait for one to complete before starting another.`,
          currentOperations: activeOps,
          maxAllowed: BULK_CONFIG.MAX_CONCURRENT_OPERATIONS,
          suggestion: "Large uploads are processed in the background. Please be patient."
        },
        { status: 409 } // Conflict instead of rate limit
      )
    }

    // Check user's current switch count
    const currentSwitchCount = await prisma.switch.count({
      where: { userId }
    })

    const body = await request.json()
    const { switches, batchId } = bulkSwitchSchema.parse(body)

    // Initialize performance monitoring
    monitor = new BulkOperationMonitor(userId, 'bulk_create', switches.length)

    // Check if adding these switches would exceed user limit (generous limit for collectors)
    if (currentSwitchCount + switches.length > BULK_CONFIG.MAX_TOTAL_SWITCHES_PER_USER) {
      monitor.addError(`User limit exceeded: ${currentSwitchCount + switches.length} > ${BULK_CONFIG.MAX_TOTAL_SWITCHES_PER_USER}`)
      return NextResponse.json(
        { 
          error: `Adding ${switches.length} switches would exceed the maximum limit of ${BULK_CONFIG.MAX_TOTAL_SWITCHES_PER_USER} switches per user. Current count: ${currentSwitchCount}`,
          currentCount: currentSwitchCount,
          maxAllowed: BULK_CONFIG.MAX_TOTAL_SWITCHES_PER_USER,
          remainingCapacity: BULK_CONFIG.MAX_TOTAL_SWITCHES_PER_USER - currentSwitchCount,
          suggestion: "Consider organizing your collection or contact support if you need a higher limit."
        },
        { status: 400 }
      )
    }

    // Track this bulk operation (for concurrency control, not rate limiting)
    activeBulkOperations.set(userId, activeOps + 1)

    try {
      const results = {
        success: 0,
        failed: 0,
        errors: [] as string[]
      }

      // Process switches in optimized batches for better performance
      const batchSize = 25 // Larger batches for better throughput
      for (let i = 0; i < switches.length; i += batchSize) {
        const batch = switches.slice(i, i + batchSize)
        
        // Process batch items in parallel for speed
        const batchPromises = batch.map(async (switchData, index) => {
          try {
            // Transform and validate data
            const transformedData = transformSwitchData(switchData)

            // Normalize manufacturer name if provided (cached for performance)
            if (transformedData.manufacturer) {
              transformedData.manufacturer = await normalizeManufacturerName(
                transformedData.manufacturer, 
                userId
              )
            }

            // Create switch in database
            await prisma.switch.create({
              data: {
                ...transformedData,
                userId,
              },
            })

            results.success++
          } catch (error) {
            results.failed++
            const errorMsg = error instanceof Error ? error.message : 'Unknown error'
            results.errors.push(`Switch ${i + index + 1}: ${errorMsg}`)
            monitor?.addError(`Switch ${i + index + 1}: ${errorMsg}`)
          }
        })

        // Process batch with error handling
        await Promise.allSettled(batchPromises)

        // Minimal delay between batches (only for very large uploads)
        if (i + batchSize < switches.length && switches.length > 1000) {
          await new Promise(resolve => setTimeout(resolve, BULK_CONFIG.PROCESSING_DELAY_MS))
        }
      }

      // Complete monitoring
      const metrics = monitor?.complete()

      return NextResponse.json({
        message: "Bulk operation completed successfully",
        results,
        batchId,
        processed: switches.length,
        performance: {
          duration: metrics?.duration,
          itemsPerSecond: metrics?.duration ? Math.round((switches.length / metrics.duration) * 1000) : 0
        },
        config: {
          maxSwitchesPerRequest: BULK_CONFIG.MAX_SWITCHES_PER_REQUEST,
          userSwitchLimit: BULK_CONFIG.MAX_TOTAL_SWITCHES_PER_USER,
          currentUserCount: currentSwitchCount + results.success
        }
      })

    } finally {
      // Always decrement active operations counter
      const currentOps = activeBulkOperations.get(userId) || 1
      if (currentOps <= 1) {
        activeBulkOperations.delete(userId)
      } else {
        activeBulkOperations.set(userId, currentOps - 1)
      }
    }

  } catch (error) {
    // Complete monitoring with error
    monitor?.addError(error instanceof Error ? error.message : 'Unknown error')
    monitor?.complete()

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Bulk create error:", error)
    return NextResponse.json(
      { 
        error: "Failed to process bulk operation", 
        details: error instanceof Error ? error.message : 'Unknown error',
        suggestion: "Please try again with a smaller batch or contact support if the problem persists."
      },
      { status: 500 }
    )
  }
}

// Bulk update handler for editing multiple switches
async function bulkUpdateHandler(request: NextRequest) {
  let monitor: BulkOperationMonitor | null = null
  
  try {
    const session = await auth()
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      )
    }

    const userId = session.user.id
    const body = await request.json()
    const { switches } = bulkSwitchSchema.parse(body)

    // Initialize performance monitoring
    monitor = new BulkOperationMonitor(userId, 'bulk_update', switches.length)

    const results = {
      success: 0,
      failed: 0,
      errors: [] as string[]
    }

    // Process switches in batches
    const batchSize = 25
    for (let i = 0; i < switches.length; i += batchSize) {
      const batch = switches.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (switchData, index) => {
        try {
          // Verify the switch belongs to the user
          const existingSwitch = await prisma.switch.findFirst({
            where: {
              id: switchData.id,
              userId
            }
          })

          if (!existingSwitch) {
            throw new Error('Switch not found or unauthorized')
          }

          // Transform and validate data
          const transformedData = transformSwitchData(switchData)

          // Normalize manufacturer name if provided
          if (transformedData.manufacturer) {
            transformedData.manufacturer = await normalizeManufacturerName(
              transformedData.manufacturer, 
              userId
            )
          }

          // Update switch in database
          await prisma.switch.update({
            where: { id: switchData.id },
            data: transformedData,
          })

          results.success++
        } catch (error) {
          results.failed++
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          results.errors.push(`Switch ${i + index + 1}: ${errorMsg}`)
          monitor?.addError(`Switch ${i + index + 1}: ${errorMsg}`)
        }
      })

      await Promise.allSettled(batchPromises)
    }

    // Complete monitoring
    const metrics = monitor?.complete()

    return NextResponse.json({
      message: "Bulk update completed successfully",
      results,
      processed: switches.length,
      performance: {
        duration: metrics?.duration,
        itemsPerSecond: metrics?.duration ? Math.round((switches.length / metrics.duration) * 1000) : 0
      }
    })

  } catch (error) {
    // Complete monitoring with error
    monitor?.addError(error instanceof Error ? error.message : 'Unknown error')
    monitor?.complete()

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Invalid input data", details: error.errors },
        { status: 400 }
      )
    }

    console.error("Bulk update error:", error)
    return NextResponse.json(
      { 
        error: "Failed to process bulk update", 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// NO RATE LIMITING on bulk operations - users should be able to upload their collections freely
export const POST = bulkCreateHandler
export const PUT = bulkUpdateHandler

// Cleanup active operations periodically
setInterval(() => {
  // In a real production environment, you might want to use Redis with TTL
  // For now, we'll keep this simple since operations should complete quickly
}, 300000) // 5 minutes