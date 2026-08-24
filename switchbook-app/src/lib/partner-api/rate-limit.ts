import { createClient } from 'redis'

type LimitResult = { allowed: boolean; remaining: number; resetAt: number }
const fallback = new Map<string, { count: number; resetAt: number }>()
let redisClient: ReturnType<typeof createClient> | null = null

async function getRedis() {
  if (!process.env.REDIS_URL) return null
  if (!redisClient) {
    redisClient = createClient({ url: process.env.REDIS_URL })
    redisClient.on('error', error => console.error('[partner-rate-limit] redis', error))
  }
  if (!redisClient.isOpen) await redisClient.connect()
  return redisClient
}

export async function consumeRateLimit(key: string, limit: number): Promise<LimitResult> {
  const minute = Math.floor(Date.now() / 60_000)
  const resetAt = (minute + 1) * 60_000
  try {
    const redis = await getRedis()
    if (redis) {
      const redisKey = `partner-rate:${minute}:${key}`
      const count = await redis.incr(redisKey)
      if (count === 1) await redis.expire(redisKey, 65)
      return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt }
    }
  } catch (error) {
    console.error('[partner-rate-limit] falling back to process memory', error)
  }

  const existing = fallback.get(key)
  const item = !existing || existing.resetAt <= Date.now() ? { count: 0, resetAt } : existing
  item.count += 1
  fallback.set(key, item)
  return { allowed: item.count <= limit, remaining: Math.max(0, limit - item.count), resetAt: item.resetAt }
}
