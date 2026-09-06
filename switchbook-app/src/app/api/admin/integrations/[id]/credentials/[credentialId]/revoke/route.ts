import { prisma } from '@/lib/prisma'
import { AdminIntegrationStore } from '@/lib/admin-integrations'
import { noStoreJson, requireIntegrationAdmin, safeIntegrationError } from '@/lib/admin-integration-http'

export async function POST(request: Request & { nextUrl: { origin: string } }, { params }: { params: Promise<{ id: string; credentialId: string }> }) {
  const access = await requireIntegrationAdmin(request)
  if ('response' in access) return access.response
  try {
    const { id, credentialId } = await params
    return noStoreJson(await new AdminIntegrationStore(prisma).revoke({ applicationId: id, credentialId, actorUserId: access.actorUserId }))
  } catch (error) { return safeIntegrationError(error) }
}
