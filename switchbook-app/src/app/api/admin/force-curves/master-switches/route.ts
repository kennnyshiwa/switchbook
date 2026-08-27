import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const query = new URL(request.url).searchParams.get('query')?.trim() || ''
  if (query.length < 2 || query.length > 120) return NextResponse.json({ error: 'Search must contain 2-120 characters' }, { status: 400 })
  const matches = await prisma.masterSwitch.findMany({ where: { status: 'APPROVED', OR: [{ id: query }, { name: { contains: query, mode: 'insensitive' } }, { manufacturer: { contains: query, mode: 'insensitive' } }] }, select: { id: true, name: true, manufacturer: true, technology: true, type: true }, orderBy: [{ manufacturer: 'asc' }, { name: 'asc' }, { id: 'asc' }], take: 50 })
  return NextResponse.json(matches)
}
