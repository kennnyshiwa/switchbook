/**
 * Utilities for handling large-scale bulk operations safely
 */

interface BulkOperationConfig {
  batchSize: number
  delayBetweenBatches: number
  maxRetries: number
  progressCallback?: (progress: BulkProgress) => void
}

interface BulkProgress {
  total: number
  processed: number
  successful: number
  failed: number
  currentBatch: number
  totalBatches: number
  errors: string[]
}

interface BulkSwitchData {
  [key: string]: any
}

const DEFAULT_CONFIG: BulkOperationConfig = {
  batchSize: 500, // Process 500 switches per API call (matches backend limit)
  delayBetweenBatches: 2000, // 2 second delay between batches (for very large uploads)
  maxRetries: 5, // More retries for better reliability
}

/**
 * Safely processes large arrays of switch data using the bulk API endpoint
 */
export async function processBulkSwitches(
  switches: BulkSwitchData[],
  config: Partial<BulkOperationConfig> = {}
): Promise<BulkProgress> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const totalBatches = Math.ceil(switches.length / finalConfig.batchSize)
  
  const progress: BulkProgress = {
    total: switches.length,
    processed: 0,
    successful: 0,
    failed: 0,
    currentBatch: 0,
    totalBatches,
    errors: []
  }

  // Pre-flight check: Warn if this is an extremely large operation
  if (switches.length > 5000) {
    const shouldContinue = confirm(
      `You are about to upload ${switches.length} switches. This is a very large operation that may take 10+ minutes. Your browser tab should stay open during the upload. Continue?`
    )
    if (!shouldContinue) {
      throw new Error('Operation cancelled by user')
    }
  } else if (switches.length > 2000) {
    const shouldContinue = confirm(
      `You are about to upload ${switches.length} switches. This may take several minutes. Continue?`
    )
    if (!shouldContinue) {
      throw new Error('Operation cancelled by user')
    }
  }

  // More generous limits for serious collectors
  if (switches.length > 20000) {
    throw new Error(
      `Upload size too large. Maximum 20,000 switches per bulk operation. You have ${switches.length} switches. Please split into multiple uploads.`
    )
  }

  // Process in batches
  for (let i = 0; i < switches.length; i += finalConfig.batchSize) {
    const batch = switches.slice(i, i + finalConfig.batchSize)
    progress.currentBatch = Math.floor(i / finalConfig.batchSize) + 1
    
    let retries = 0
    let batchSuccess = false
    
    while (retries <= finalConfig.maxRetries && !batchSuccess) {
      try {
        const response = await fetch('/api/switches/bulk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            switches: batch,
            batchId: `batch-${progress.currentBatch}-${Date.now()}`
          })
        })

        if (response.status === 409) {
          // Conflict (too many concurrent operations) - wait and retry
          const retryAfter = 30 // Default wait time
          progress.errors.push(`Too many concurrent operations on batch ${progress.currentBatch}, waiting ${retryAfter} seconds...`)
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000))
          retries++
          continue
        }

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const result = await response.json()
        progress.successful += result.results.success
        progress.failed += result.results.failed
        progress.processed += batch.length
        
        if (result.results.errors.length > 0) {
          progress.errors.push(...result.results.errors)
        }
        
        batchSuccess = true
        
      } catch (error) {
        retries++
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        
        if (retries > finalConfig.maxRetries) {
          progress.errors.push(`Batch ${progress.currentBatch} failed after ${finalConfig.maxRetries} retries: ${errorMsg}`)
          progress.failed += batch.length
          progress.processed += batch.length
          break
        } else {
          progress.errors.push(`Batch ${progress.currentBatch} attempt ${retries} failed: ${errorMsg}, retrying...`)
          // Exponential backoff for retries
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000))
        }
      }
    }

    // Update progress callback
    if (finalConfig.progressCallback) {
      finalConfig.progressCallback({ ...progress })
    }

    // Delay between batches (except for the last batch)
    if (i + finalConfig.batchSize < switches.length) {
      await new Promise(resolve => setTimeout(resolve, finalConfig.delayBetweenBatches))
    }
  }

  return progress
}

/**
 * Estimates the time required for a bulk operation
 */
export function estimateBulkOperationTime(switchCount: number): {
  estimatedMinutes: number
  estimatedSeconds: number
  warning?: string
} {
  const batchSize = DEFAULT_CONFIG.batchSize
  const delayBetweenBatches = DEFAULT_CONFIG.delayBetweenBatches / 1000 // Convert to seconds
  const avgProcessingTimePerBatch = 2 // Assume 2 seconds per batch for API processing
  
  const totalBatches = Math.ceil(switchCount / batchSize)
  const totalDelayTime = (totalBatches - 1) * delayBetweenBatches
  const totalProcessingTime = totalBatches * avgProcessingTimePerBatch
  const totalTimeSeconds = totalDelayTime + totalProcessingTime
  
  const estimatedMinutes = Math.floor(totalTimeSeconds / 60)
  const estimatedSeconds = Math.round(totalTimeSeconds % 60)
  
  let warning: string | undefined
  if (switchCount > 1000) {
    warning = "Large upload detected. Please ensure your internet connection is stable."
  }
  if (switchCount > 3000) {
    warning = "Very large upload. Consider splitting into multiple smaller uploads for better reliability."
  }
  
  return {
    estimatedMinutes,
    estimatedSeconds,
    warning
  }
}

/**
 * Validates bulk upload data before processing
 */
export function validateBulkUploadData(switches: BulkSwitchData[]): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []
  
  // Check basic constraints
  if (switches.length === 0) {
    errors.push("No switches to upload")
  }
  
  if (switches.length > 5000) {
    errors.push(`Too many switches (${switches.length}). Maximum 5000 per upload.`)
  }
  
  if (switches.length > 2000) {
    warnings.push(`Large upload (${switches.length} switches). This may take several minutes.`)
  }
  
  // Check for required fields
  switches.forEach((switchData, index) => {
    if (!switchData.name || switchData.name.trim() === '') {
      errors.push(`Switch ${index + 1}: Name is required`)
    }
  })
  
  // Check for potential duplicates within the upload
  const names = switches.map(s => s.name?.toLowerCase().trim()).filter(Boolean)
  const duplicateNames = names.filter((name, index) => names.indexOf(name) !== index)
  
  if (duplicateNames.length > 0) {
    warnings.push(`Potential duplicates detected: ${[...new Set(duplicateNames)].join(', ')}`)
  }
  
  return {
    isValid: errors.length === 0,
    errors,
    warnings
  }
}

/**
 * Chunks an array into smaller arrays of specified size
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

/**
 * Creates a progress display string
 */
export function formatBulkProgress(progress: BulkProgress): string {
  const percentage = Math.round((progress.processed / progress.total) * 100)
  return `${percentage}% (${progress.processed}/${progress.total}) - ${progress.successful} successful, ${progress.failed} failed`
}