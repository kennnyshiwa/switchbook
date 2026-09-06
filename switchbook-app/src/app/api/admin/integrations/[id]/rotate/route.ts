import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { AdminIntegrationStore } from '@/lib/admin-integrations'
import { noStoreJson, requireIntegrationAdmin, safeIntegrationError } from '@/lib/admin-integration-http'

const schema = z.object({ revokeExisting: z.boolean(), expiresAt: z.string().datetime().nullable() }).strict()

export async function POST(request: Request & { nextUrl: { origin: string } }, { params }: { params: Promise<{ id: string }> }) {
  const access = await requireIntegrationAdmin(request)
  if ('response' in access) return access.response
  try {
    const parsed = schema.parse(await request.json())
    const expiresAt = parsed.expiresAt ? new Date(parsed.expiresAt) : null
    if (expiresAt && expiresAt <= new Date()) return noStoreJson({ error: 'Expiry must be in the future' }, { status: 400 })
    const { id } = await params
    return noStoreJson(await new AdminIntegrationStore(prisma).rotate({ applicationId: id, revokeExisting: parsed.revokeExisting, expiresAt, actorUserId: access.actorUserId }))
  } catch (error) { return safeIntegrationError(error) }
}
