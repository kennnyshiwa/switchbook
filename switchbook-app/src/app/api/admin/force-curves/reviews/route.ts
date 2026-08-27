import { ForceCurveMappingState } from '@prisma/client'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { selectAutomaticCandidates } from '@/lib/force-curves'
async function admin() { const session = await auth(); return session?.user?.role === 'ADMIN' ? session : null }
const ids = (payload: unknown) => typeof payload === 'object' && payload && Array.isArray((payload as { candidateIds?: unknown }).candidateIds) ? (payload as { candidateIds: string[] }).candidateIds : []
export async function GET() {
  if (!await admin()) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const reviews = await prisma.forceCurveReviewCase.findMany({ where: { status: 'OPEN' }, include: { masterSwitch: { select: { id: true, name: true, manufacturer: true, technology: true } }, catalogEntry: true, feedback: true }, orderBy: { createdAt: 'asc' } })
  const allIds = [...new Set(reviews.flatMap(r => [...ids(r.payload), ...(r.catalogEntryId ? [r.catalogEntryId] : [])]))]
  const candidates = await prisma.forceCurveCatalogEntry.findMany({ where: { id: { in: allIds }, exists: true } })
  return NextResponse.json(reviews.map(r => ({ ...r, candidates: candidates.filter(c => ids(r.payload).includes(c.id) || r.catalogEntryId === c.id) })))
}
export async function POST(request: NextRequest) {
  const session = await admin(); if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const { reviewId, resolution, catalogEntryId, reason } = await request.json() as { reviewId: string; resolution: ForceCurveMappingState; catalogEntryId?: string; reason?: string }
  if (!['MANUALLY_APPROVED','REJECTED','NO_MATCH'].includes(resolution)) return NextResponse.json({ error: 'Invalid resolution' }, { status: 400 })
  const review = await prisma.forceCurveReviewCase.findUnique({ where: { id: reviewId }, include: { masterSwitch: true } })
  if (!review || review.status !== 'OPEN') return NextResponse.json({ error: 'Open review not found' }, { status: 404 })
  if (!review.masterSwitchId || !review.masterSwitch) return NextResponse.json({ error: 'Review must be linked to a master switch before resolution' }, { status: 409 })
  let candidate = null
  if (catalogEntryId) candidate = await prisma.forceCurveCatalogEntry.findUnique({ where: { id: catalogEntryId } })
  if (resolution === 'MANUALLY_APPROVED') {
    const allowed = new Set([...ids(review.payload), ...(review.catalogEntryId ? [review.catalogEntryId] : [])])
    if (!candidate || !candidate.exists || !allowed.has(candidate.id)) return NextResponse.json({ error: 'Candidate is not an extant member of this review' }, { status: 400 })
    if (!selectAutomaticCandidates(review.masterSwitch, [candidate]).length) return NextResponse.json({ error: 'Candidate fails manufacturer/technology/path compatibility' }, { status: 409 })
  }
  await prisma.$transaction(async tx => {
    if (resolution === 'NO_MATCH') {
      await tx.forceCurveMapping.updateMany({ where: { masterSwitchId: review.masterSwitchId!, state: { in: ['AUTO_APPROVED','MANUALLY_APPROVED'] } }, data: { state: 'STALE', reason: 'Superseded by manual no-match decision' } })
      await tx.forceCurveMapping.upsert({ where: { noMatchKey: review.masterSwitchId! }, create: { masterSwitchId: review.masterSwitchId!, noMatchKey: review.masterSwitchId!, state: 'NO_MATCH', provenance: 'admin-review', decidedById: session.user.id, decidedAt: new Date(), reason }, update: { state: 'NO_MATCH', decidedById: session.user.id, decidedAt: new Date(), reason } })
    } else {
      await tx.forceCurveMapping.deleteMany({ where: { noMatchKey: review.masterSwitchId! } })
      const existing = await tx.forceCurveMapping.findFirst({ where: { masterSwitchId: review.masterSwitchId!, catalogEntryId: catalogEntryId || review.catalogEntryId } })
      const targetId = catalogEntryId || review.catalogEntryId
      if (!targetId) throw new Error('Catalog entry required for candidate decision')
      if (existing) await tx.forceCurveMapping.update({ where: { id: existing.id }, data: { state: resolution, provenance: 'admin-review', decidedById: session.user.id, decidedAt: new Date(), reason } })
      else await tx.forceCurveMapping.create({ data: { masterSwitchId: review.masterSwitchId!, catalogEntryId: targetId, state: resolution, provenance: 'admin-review', decidedById: session.user.id, decidedAt: new Date(), reason } })
    }
    await tx.forceCurveReviewCase.update({ where: { id: reviewId }, data: { status: 'RESOLVED', resolution, resolvedById: session.user.id, resolvedAt: new Date() } })
  })
  return NextResponse.json({ success: true })
}
export async function PATCH(request: NextRequest) {
  const session = await admin(); if (!session) return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  const { reviewId, catalogEntryId, manufacturer, technology } = await request.json() as { reviewId: string; catalogEntryId: string; manufacturer: string; technology: 'MECHANICAL'|'OPTICAL'|'MAGNETIC'|'INDUCTIVE'|'ELECTRO_CAPACITIVE' }
  const review = await prisma.forceCurveReviewCase.findUnique({ where: { id: reviewId } })
  const entry = await prisma.forceCurveCatalogEntry.findUnique({ where: { id: catalogEntryId } })
  if (!review || review.status !== 'OPEN' || !review.masterSwitchId || !entry?.exists) return NextResponse.json({ error: 'Open review, master, and extant catalog entry required' }, { status: 400 })
  if (!manufacturer?.trim() || !['MECHANICAL','OPTICAL','MAGNETIC','INDUCTIVE','ELECTRO_CAPACITIVE'].includes(technology)) return NextResponse.json({ error: 'Verified manufacturer and technology required' }, { status: 400 })
  const payload = typeof review.payload === 'object' && review.payload && !Array.isArray(review.payload) ? review.payload as Record<string, unknown> : {}
  const candidateIds = [...new Set([...(Array.isArray(payload.candidateIds) ? payload.candidateIds as string[] : []), catalogEntryId])]
  await prisma.$transaction([
    prisma.forceCurveCatalogEntry.update({ where: { id: catalogEntryId }, data: { manufacturer: manufacturer.trim(), technology, metadataVerifiedAt: new Date(), metadataVerifiedById: session.user.id } }),
    prisma.forceCurveReviewCase.update({ where: { id: reviewId }, data: { catalogEntryId, payload: { ...payload, candidateIds, metadataVerification: { catalogEntryId, manufacturer: manufacturer.trim(), technology, verifiedById: session.user.id, verifiedAt: new Date().toISOString() } } } })
  ])
  return NextResponse.json({ success: true })
}
