import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sha256 } from './crypto'
import { PartnerApiError } from './errors'

export function classifyIdempotency(existing: { requestHash: string; responseStatus: number; responseBody: Prisma.JsonValue }, requestHash: string) {
  if (existing.requestHash !== requestHash) throw new PartnerApiError(409, 'idempotency_conflict', 'Idempotency key was used for a different request')
  if (existing.responseStatus === 0) throw new PartnerApiError(409, 'request_in_progress', 'The original request is still processing')
  return { status: existing.responseStatus, body: existing.responseBody }
}

export async function beginIdempotent(applicationId: string, key: string | null, body: unknown) {
  if (!key || key.length > 200) throw new PartnerApiError(400, 'idempotency_key_required', 'A valid Idempotency-Key header is required')
  const requestHash = sha256(JSON.stringify(body))
  try {
    await prisma.partnerIdempotencyKey.create({ data: {
      applicationId, key, requestHash, responseStatus: 0, responseBody: {},
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    } })
    return { replay: null, requestHash, key }
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
  }
  const existing = await prisma.partnerIdempotencyKey.findUnique({ where: { applicationId_key: { applicationId, key } } })
  if (!existing) throw new PartnerApiError(409, 'request_in_progress', 'An identical request is already being reserved')
  return { replay: classifyIdempotency(existing, requestHash), requestHash, key }
}

export async function finishIdempotent(applicationId: string, key: string, requestHash: string, status: number, body: Prisma.InputJsonValue) {
  await prisma.partnerIdempotencyKey.update({
    where: { applicationId_key: { applicationId, key } },
    data: { requestHash, responseStatus: status, responseBody: body },
  })
}
