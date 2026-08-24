import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export class PartnerApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message)
  }
}

export function errorResponse(error: unknown, requestId: string) {
  const known = error instanceof PartnerApiError
  const status = known ? error.status : 500
  const body = {
    error: {
      code: known ? error.code : 'internal_error',
      message: known ? error.message : 'An unexpected error occurred',
      ...(known && error.details ? { details: error.details } : {}),
      requestId,
    },
  }
  if (!known) console.error('[partner-api]', requestId, error)
  void prisma.partnerAuditEvent.create({ data: {
    requestId,
    action: 'partner.request.failed',
    statusCode: status,
    metadata: { code: body.error.code },
  }}).catch(auditError => console.error('[partner-audit-failure]', requestId, auditError))
  console.info(JSON.stringify({ event: 'partner_api_failure', requestId, statusCode: status, code: body.error.code }))
  return NextResponse.json(body, { status, headers: { 'X-Request-Id': requestId } })
}
