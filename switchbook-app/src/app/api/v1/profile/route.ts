import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requirePartner } from '@/lib/partner-api/auth'
import { errorResponse, PartnerApiError } from '@/lib/partner-api/errors'

export async function GET(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  try {
    const principal = await requirePartner(request, ['profile:read'])
    if (!principal.userId) throw new PartnerApiError(403, 'user_authorization_required', 'An OAuth user token is required')
    const user = await prisma.user.findUnique({ where: { id: principal.userId }, select: { id: true, username: true, email: true, emailVerified: true, createdAt: true } })
    if (!user) throw new PartnerApiError(404, 'not_found', 'Profile not found')
    return NextResponse.json({ data: { sub: user.id, username: user.username, email: user.email, emailVerified: !!user.emailVerified, createdAt: user.createdAt } })
  } catch (error) { return errorResponse(error, requestId) }
}
