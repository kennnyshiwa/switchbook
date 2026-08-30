import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { catalogMasterSearchTerms, resolveUniqueCatalogMaster, resolvedCatalogMasterCompatibility } from '@/lib/admin-force-curves'
import { FORCE_CURVE_SOURCE } from '@/lib/force-curves'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const params = new URL(request.url).searchParams
  const query = params.get('query')?.trim() || ''
  const catalogEntryId = params.get('catalogEntryId')?.trim() || ''
  if (query.length < 2 || query.length > 120) return NextResponse.json({ error: 'Search must contain 2-120 characters' }, { status: 400 })
  if (!catalogEntryId) return NextResponse.json({ error: 'Catalog candidate is required for compatibility checking' }, { status: 400 })
  const candidate = await prisma.forceCurveCatalogEntry.findFirst({ where: { id: catalogEntryId, source: FORCE_CURVE_SOURCE, exists: true }, select: { displayName: true, repositoryPath: true, technology: true } })
  if (!candidate) return NextResponse.json({ error: 'Catalog candidate is unavailable' }, { status: 404 })
  const searchTerms = catalogMasterSearchTerms(query, candidate)
  const [matches, resolution] = await Promise.all([
    prisma.masterSwitch.findMany({ where: { status: 'APPROVED', OR: searchTerms.flatMap(term => [{ id: term }, { name: { contains: term, mode: 'insensitive' as const } }, { manufacturer: { contains: term, mode: 'insensitive' as const } }]) }, select: { id: true, name: true, manufacturer: true, technology: true, type: true }, orderBy: [{ manufacturer: 'asc' }, { name: 'asc' }, { id: 'asc' }], take: 50 }),
    resolveUniqueCatalogMaster(prisma,candidate),
  ])
  return NextResponse.json(matches.map(master => ({ ...master, compatibility: resolvedCatalogMasterCompatibility(master, candidate, resolution) })))
}
