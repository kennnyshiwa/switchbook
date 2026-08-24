import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requirePartner } from '@/lib/partner-api/auth'
import { errorResponse, PartnerApiError } from '@/lib/partner-api/errors'
import { lightweight, partnerSwitchInclude, toPartnerSwitch } from '@/lib/partner-api/catalog'

const schema = z.object({ entries: z.array(z.object({ externalId: z.string().max(200), name: z.string().min(1).max(200), manufacturer: z.string().max(150).nullable().optional() })).min(1).max(100) })

export async function POST(request: Request) {
  const requestId = request.headers.get('x-request-id') || crypto.randomUUID()
  try {
    await requirePartner(request, ['catalog:read'])
    const parsed = schema.safeParse(await request.json())
    if (!parsed.success) throw new PartnerApiError(400, 'validation_error', 'Invalid migration entries', parsed.error.flatten())
    const data = await Promise.all(parsed.data.entries.map(async entry => {
      const records = await prisma.masterSwitch.findMany({ where: { status: 'APPROVED', OR: [
        { name: { contains: entry.name, mode: 'insensitive' } },
        ...(entry.manufacturer ? [{ manufacturer: { equals: entry.manufacturer, mode: 'insensitive' as const } }] : []),
      ] }, include: partnerSwitchInclude, take: 5, orderBy: { name: 'asc' } })
      const matches = await Promise.all(records.map(toPartnerSwitch))
      return { externalId: entry.externalId, matches: matches.map(lightweight), requiresConfirmation: true }
    }))
    return NextResponse.json({ data })
  } catch (error) { return errorResponse(error, requestId) }
}
