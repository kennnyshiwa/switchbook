import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AdminIntegrationStore, MAX_INTEGRATION_RATE_LIMIT, MIN_INTEGRATION_RATE_LIMIT } from '@/lib/admin-integrations'
import { noStoreJson, requireIntegrationAdmin, safeIntegrationError } from '@/lib/admin-integration-http'

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  rateLimitPerMinute: z.number().int().min(MIN_INTEGRATION_RATE_LIMIT).max(MAX_INTEGRATION_RATE_LIMIT),
  expiresAt: z.string().datetime().nullable(),
}).strict()

export async function GET() {
  const access = await requireIntegrationAdmin()
  if ('response' in access) return access.response
  return noStoreJson({ applications: await new AdminIntegrationStore(prisma).list() })
}

export async function POST(request: Request & { nextUrl: { origin: string } }) {
  const access = await requireIntegrationAdmin(request)
  if ('response' in access) return access.response
  try {
    const parsed = createSchema.parse(await request.json())
    const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null
    if (expiresAt && expiresAt <= new Date()) return noStoreJson({ error: 'Expiry must be in the future' }, { status: 400 })
    return noStoreJson(await new AdminIntegrationStore(prisma).create({ ...parsed, expiresAt, actorUserId: access.actorUserId }), { status: 201 })
  } catch (error) { return safeIntegrationError(error) }
}
