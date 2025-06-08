/**
 * Performance monitoring for bulk operations
 */

interface PerformanceMetrics {
  operationId: string
  userId: string
  operationType: 'bulk_create' | 'bulk_update' | 'bulk_delete'
  itemCount: number
  startTime: number
  endTime?: number
  duration?: number
  memoryUsage?: NodeJS.MemoryUsage
  errors: string[]
  status: 'running' | 'completed' | 'failed'
}

// In-memory storage for performance metrics
const performanceMetrics = new Map<string, PerformanceMetrics>()

// Track active operations per user to prevent system overload
const activeOperationsByUser = new Map<string, Set<string>>()

export class BulkOperationMonitor {
  private operationId: string
  private userId: string
  private operationType: PerformanceMetrics['operationType']
  private itemCount: number
  private startTime: number
  private errors: string[] = []

  constructor(
    userId: string, 
    operationType: PerformanceMetrics['operationType'], 
    itemCount: number
  ) {
    this.operationId = `${operationType}_${userId}_${Date.now()}`
    this.userId = userId
    this.operationType = operationType
    this.itemCount = itemCount
    this.startTime = Date.now()

    // Initialize metrics
    const metrics: PerformanceMetrics = {
      operationId: this.operationId,
      userId,
      operationType,
      itemCount,
      startTime: this.startTime,
      errors: [],
      status: 'running'
    }

    performanceMetrics.set(this.operationId, metrics)

    // Track active operation for this user
    if (!activeOperationsByUser.has(userId)) {
      activeOperationsByUser.set(userId, new Set())
    }
    activeOperationsByUser.get(userId)!.add(this.operationId)
  }

  /**
   * Add an error to the operation log
   */
  addError(error: string): void {
    this.errors.push(error)
    const metrics = performanceMetrics.get(this.operationId)
    if (metrics) {
      metrics.errors.push(error)
    }
  }

  /**
   * Complete the operation and record final metrics
   */
  complete(): PerformanceMetrics {
    const endTime = Date.now()
    const duration = endTime - this.startTime
    const memoryUsage = process.memoryUsage()

    const metrics: PerformanceMetrics = {
      operationId: this.operationId,
      userId: this.userId,
      operationType: this.operationType,
      itemCount: this.itemCount,
      startTime: this.startTime,
      endTime,
      duration,
      memoryUsage,
      errors: this.errors,
      status: this.errors.length > 0 ? 'failed' : 'completed'
    }

    performanceMetrics.set(this.operationId, metrics)

    // Remove from active operations
    const userOps = activeOperationsByUser.get(this.userId)
    if (userOps) {
      userOps.delete(this.operationId)
      if (userOps.size === 0) {
        activeOperationsByUser.delete(this.userId)
      }
    }

    // Log performance warnings
    this.logPerformanceWarnings(metrics)

    return metrics
  }

  /**
   * Check if user has too many active operations
   */
  static checkUserOperationLimit(userId: string, maxOperations = 3): boolean {
    const userOps = activeOperationsByUser.get(userId)
    return !userOps || userOps.size < maxOperations
  }

  /**
   * Get active operations count for a user
   */
  static getActiveOperationsCount(userId: string): number {
    const userOps = activeOperationsByUser.get(userId)
    return userOps ? userOps.size : 0
  }

  /**
   * Get performance metrics for an operation
   */
  static getMetrics(operationId: string): PerformanceMetrics | undefined {
    return performanceMetrics.get(operationId)
  }

  /**
   * Get recent performance metrics for a user
   */
  static getUserMetrics(userId: string, limit = 10): PerformanceMetrics[] {
    const userMetrics = Array.from(performanceMetrics.values())
      .filter(m => m.userId === userId)
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, limit)
    
    return userMetrics
  }

  /**
   * Clean up old metrics (keep only last 24 hours)
   */
  static cleanup(): void {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000) // 24 hours ago
    
    for (const [operationId, metrics] of performanceMetrics.entries()) {
      if (metrics.startTime < cutoffTime) {
        performanceMetrics.delete(operationId)
      }
    }
  }

  /**
   * Get system-wide performance statistics
   */
  static getSystemStats(): {
    totalOperations: number
    activeOperations: number
    avgDuration: number
    errorRate: number
    memoryUsage: NodeJS.MemoryUsage
  } {
    const allMetrics = Array.from(performanceMetrics.values())
    const completedMetrics = allMetrics.filter(m => m.status === 'completed' || m.status === 'failed')
    const activeOperations = allMetrics.filter(m => m.status === 'running').length
    
    const totalDuration = completedMetrics.reduce((sum, m) => sum + (m.duration || 0), 0)
    const avgDuration = completedMetrics.length > 0 ? totalDuration / completedMetrics.length : 0
    
    const errorCount = completedMetrics.filter(m => m.status === 'failed').length
    const errorRate = completedMetrics.length > 0 ? errorCount / completedMetrics.length : 0
    
    return {
      totalOperations: performanceMetrics.size,
      activeOperations,
      avgDuration: Math.round(avgDuration),
      errorRate: Math.round(errorRate * 100) / 100,
      memoryUsage: process.memoryUsage()
    }
  }

  /**
   * Log performance warnings for slow or problematic operations
   */
  private logPerformanceWarnings(metrics: PerformanceMetrics): void {
    const duration = metrics.duration || 0
    const itemsPerSecond = duration > 0 ? (metrics.itemCount / duration) * 1000 : 0

    if (duration > 30000) { // More than 30 seconds
      console.warn(`Slow bulk operation detected: ${metrics.operationId} took ${duration}ms for ${metrics.itemCount} items`)
    }

    if (itemsPerSecond < 10 && metrics.itemCount > 100) { // Less than 10 items per second for large operations
      console.warn(`Low throughput detected: ${metrics.operationId} processed ${itemsPerSecond.toFixed(2)} items/second`)
    }

    if (metrics.memoryUsage && metrics.memoryUsage.heapUsed > 100 * 1024 * 1024) { // More than 100MB
      console.warn(`High memory usage detected: ${metrics.operationId} used ${Math.round(metrics.memoryUsage.heapUsed / 1024 / 1024)}MB`)
    }

    if (metrics.errors.length > 0) {
      console.error(`Bulk operation errors: ${metrics.operationId} had ${metrics.errors.length} errors`)
    }
  }
}

// Cleanup old metrics every hour
setInterval(() => {
  BulkOperationMonitor.cleanup()
}, 60 * 60 * 1000)

// Export performance monitoring middleware
export function withPerformanceMonitoring(
  operationType: PerformanceMetrics['operationType']
) {
  return function <T extends any[], R>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: T) => Promise<R>>
  ) {
    const method = descriptor.value!
    
    descriptor.value = async function (...args: T): Promise<R> {
      // Extract userId and itemCount from arguments (implementation-specific)
      const userId = 'unknown' // Should be extracted from request context
      const itemCount = 0 // Should be extracted from request data
      
      const monitor = new BulkOperationMonitor(userId, operationType, itemCount)
      
      try {
        const result = await method.apply(this, args)
        monitor.complete()
        return result
      } catch (error) {
        monitor.addError(error instanceof Error ? error.message : 'Unknown error')
        monitor.complete()
        throw error
      }
    }
    
    return descriptor
  }
}