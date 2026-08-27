import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ForceCurveReviewQueue from '@/components/admin/ForceCurveReviewQueue'
export default async function Page() {
  const session = await auth(); if (session?.user?.role !== 'ADMIN') redirect('/dashboard')
  const reviews = await prisma.forceCurveReviewCase.findMany({ where: { status: 'OPEN' }, include: { masterSwitch: { select: { id: true, name: true, manufacturer: true } }, catalogEntry: true }, orderBy: { createdAt: 'asc' } })
  const ids = [...new Set(reviews.flatMap(r => typeof r.payload === 'object' && r.payload && !Array.isArray(r.payload) && Array.isArray((r.payload as {candidateIds?: unknown}).candidateIds) ? (r.payload as {candidateIds: string[]}).candidateIds : []))]
  const candidates = await prisma.forceCurveCatalogEntry.findMany({ where: { id: { in: ids }, exists: true } })
  const enriched = reviews.map(r => { const candidateIds = typeof r.payload === 'object' && r.payload && !Array.isArray(r.payload) && Array.isArray((r.payload as {candidateIds?: unknown}).candidateIds) ? (r.payload as {candidateIds: string[]}).candidateIds : []; return { ...r, candidates: candidates.filter(c => candidateIds.includes(c.id)) } })
  return <main className="mx-auto max-w-6xl p-8"><h1 className="mb-6 text-3xl font-bold">Force curve review queue</h1><ForceCurveReviewQueue initialReviews={enriched} /></main>
}
