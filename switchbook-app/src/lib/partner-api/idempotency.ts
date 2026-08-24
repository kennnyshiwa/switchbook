import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { sha256 } from './crypto'
import { PartnerApiError } from './errors'

export type IdempotencyReservation = { replay: { status: number; body: Prisma.JsonValue } | null; requestHash: string; key: string }

export function classifyIdempotency(existing: { requestHash: string; responseStatus: number; responseBody: Prisma.JsonValue; expiresAt?: Date }, requestHash: string, now = new Date()) {
  if (existing.expiresAt && existing.expiresAt <= now) return null
  if (existing.requestHash !== requestHash) throw new PartnerApiError(409, 'idempotency_conflict', 'Idempotency key was used for a different request')
  if (existing.responseStatus === 0) throw new PartnerApiError(409, 'request_in_progress', 'The original request is still processing')
  return { status: existing.responseStatus, body: existing.responseBody }
}

export async function beginIdempotent(applicationId: string, key: string | null, body: unknown) {
  if (!key || key.length > 200) throw new PartnerApiError(400, 'idempotency_key_required', 'A valid Idempotency-Key header is required')
  const requestHash = sha256(JSON.stringify(body))
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await prisma.$transaction(async tx => {
        await tx.partnerIdempotencyKey.deleteMany({ where: { applicationId, key, expiresAt: { lte: new Date() } } })
        await tx.partnerIdempotencyKey.create({ data: {
          applicationId, key, requestHash, responseStatus: 0, responseBody: {},
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        } })
      })
      return { replay: null, requestHash, key } satisfies IdempotencyReservation
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error
    }
    const existing = await prisma.partnerIdempotencyKey.findUnique({ where: { applicationId_key: { applicationId, key } } })
    if (!existing) continue
    const replay = classifyIdempotency(existing, requestHash)
    if (replay) return { replay, requestHash, key } satisfies IdempotencyReservation
  }
  throw new PartnerApiError(409, 'request_in_progress', 'An identical request is already being reserved')
}

export async function releaseIdempotent(applicationId: string, reservation: IdempotencyReservation) {
  await prisma.partnerIdempotencyKey.deleteMany({ where: {
    applicationId, key: reservation.key, requestHash: reservation.requestHash, responseStatus: 0,
  } })
}

export async function failIdempotent(applicationId: string, reservation: IdempotencyReservation, error: unknown, requestId: string) {
  try {
    if (reservation.replay) return
    if (error instanceof PartnerApiError && error.status >= 400 && error.status < 500) {
      await finishIdempotent(applicationId, reservation.key, reservation.requestHash, error.status, storedPartnerError(error, requestId).body)
    } else {
      await releaseIdempotent(applicationId, reservation)
    }
  } catch (cleanupError) {
    console.error('[partner-idempotency-cleanup]', requestId, cleanupError)
  }
}

export async function finishIdempotent(applicationId: string, key: string, requestHash: string, status: number, body: Prisma.InputJsonValue) {
  await prisma.partnerIdempotencyKey.update({
    where: { applicationId_key: { applicationId, key } },
    data: { requestHash, responseStatus: status, responseBody: body },
  })
}

export type StoredIdempotentResult<T extends Prisma.InputJsonValue = Prisma.InputJsonValue> = {
  status: number
  body: T
}

/** Commit the reservation, business mutations, and replay response as one serializable unit. */
export async function runIdempotentTransaction<T extends Prisma.InputJsonValue>(
  applicationId: string,
  key: string | null,
  requestBody: unknown,
  work: (tx: Prisma.TransactionClient) => Promise<StoredIdempotentResult<T>>,
) {
  if (!key || key.length > 200) throw new PartnerApiError(400, 'idempotency_key_required', 'A valid Idempotency-Key header is required')
  const requestHash = sha256(JSON.stringify(requestBody))
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        await tx.partnerIdempotencyKey.deleteMany({ where: { applicationId, key, expiresAt: { lte: new Date() } } })
        const existing = await tx.partnerIdempotencyKey.findUnique({ where: { applicationId_key: { applicationId, key } } })
        if (existing) {
          const replay = classifyIdempotency(existing, requestHash)
          if (replay) return { ...replay, replayed: true }
        }
        await tx.partnerIdempotencyKey.create({ data: {
          applicationId, key, requestHash, responseStatus: 0, responseBody: {},
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        } })
        const result = await work(tx)
        await tx.partnerIdempotencyKey.update({
          where: { applicationId_key: { applicationId, key } },
          data: { responseStatus: result.status, responseBody: result.body },
        })
        return { ...result, replayed: false }
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable })
    } catch (error) {
      const retryable = error instanceof Prisma.PrismaClientKnownRequestError && (error.code === 'P2034' || error.code === 'P2002')
      if (retryable && attempt < 3) continue
      throw error
    }
  }
  throw new PartnerApiError(409, 'request_in_progress', 'An identical request is already being processed')
}

export function storedPartnerError(error: PartnerApiError, requestId: string): StoredIdempotentResult {
  return {
    status: error.status,
    body: { error: {
      code: error.code,
      message: error.message,
      ...(error.details === undefined ? {} : { details: error.details as Prisma.InputJsonValue }),
      requestId,
    } },
  }
}
