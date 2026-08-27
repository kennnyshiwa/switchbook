import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
export async function GET(request: NextRequest) {
  const session = await auth(); if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const query = new URL(request.url).searchParams.get('query')?.trim() || ''
  return NextResponse.json(await prisma.forceCurveCatalogEntry.findMany({ where: { exists: true, ...(query ? { OR: [{ repositoryPath: { contains: query, mode: 'insensitive' } }, { displayName: { contains: query, mode: 'insensitive' } }] } : {}) }, orderBy: { repositoryPath: 'asc' }, take: 50 }))
}
