import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { FORCE_CURVE_SOURCE } from '@/lib/force-curves'
import { normalizeForceCurveIdentity, rankForceCurveSuggestion } from '@/lib/admin-force-curve-suggestions'

const enabled = () => process.env.FORCE_CURVE_RANK_ASSIST_ENABLED === 'true'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  if (!enabled()) return NextResponse.json({ error: 'Rank assist is disabled' }, { status: 404 })
  const catalogEntryId = request.nextUrl.searchParams.get('catalogEntryId')?.trim() || ''
  if (!catalogEntryId) return NextResponse.json({ error: 'Catalog candidate is required' }, { status: 400 })
  const catalog = await prisma.forceCurveCatalogEntry.findFirst({
    where: { id: catalogEntryId, source: FORCE_CURVE_SOURCE, exists: true },
    select: { id: true, displayName: true, repositoryPath: true, manufacturer: true, technology: true },
  })
  if (!catalog) return NextResponse.json({ suggestion: null, exclusion: 'CATALOG_UNAVAILABLE' })
  const terms = [...new Set([catalog.displayName, catalog.repositoryPath.split('/')[0]])]
    .flatMap(value => normalizeForceCurveIdentity(value).split(' '))
    .filter(value => value.length >= 4)
    .sort((a, b) => b.length - a.length || a.localeCompare(b)).slice(0, 4)
  if (!terms.length) return NextResponse.json({ suggestion: null, exclusion: 'IDENTITY_TOO_SHORT' })
  const masters = await prisma.masterSwitch.findMany({
    where: { status: 'APPROVED', OR: terms.map(term => ({ name: { contains: term, mode: 'insensitive' as const } })) },
    select: { id: true, name: true, manufacturer: true, technology: true },
    orderBy: [{ name: 'asc' }, { id: 'asc' }], take: 101,
  })
  const overflow = masters.length > 100
  const suggestion = rankForceCurveSuggestion(catalog, masters.slice(0, 100), overflow)
  return NextResponse.json({ suggestion, exclusion: suggestion ? null : overflow ? 'QUERY_OVERFLOW' : 'NO_UNIQUE_EXACT_OR_BOUNDARY_MATCH' })
}
