import { createClient } from 'redis'

type LimitResult = { allowed: boolean; remaining: number; resetAt: number }
let redisClient: ReturnType<typeof createClient> | null = null

async function getRedis() {
  if (!process.env.REDIS_URL) throw new Error('REDIS_URL is required for partner API rate limiting')
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
  const redis = await getRedis()
  const redisKey = `partner-rate:${minute}:${key}`
  const count = await redis.incr(redisKey)
  if (count === 1) await redis.expire(redisKey, 65)
  return { allowed: count <= limit, remaining: Math.max(0, limit - count), resetAt }
}
