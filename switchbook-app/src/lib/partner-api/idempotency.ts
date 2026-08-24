import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sha256 } from './crypto'
import { PartnerApiError } from './errors'

export async function beginIdempotent(applicationId: string, key: string | null, body: unknown) {
  if (!key || key.length > 200) throw new PartnerApiError(400, 'idempotency_key_required', 'A valid Idempotency-Key header is required')
  const requestHash = sha256(JSON.stringify(body))
  const existing = await prisma.partnerIdempotencyKey.findUnique({ where: { applicationId_key: { applicationId, key } } })
  if (existing) {
    if (existing.requestHash !== requestHash) throw new PartnerApiError(409, 'idempotency_conflict', 'Idempotency key was used for a different request')
    return { replay: { status: existing.responseStatus, body: existing.responseBody }, requestHash, key }
  }
  return { replay: null, requestHash, key }
}

export async function finishIdempotent(applicationId: string, key: string, requestHash: string, status: number, body: Prisma.InputJsonValue) {
  await prisma.partnerIdempotencyKey.create({ data: {
    applicationId, key, requestHash, responseStatus: status, responseBody: body,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  } })
}
