import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ForceCurveReviewQueue from '@/components/admin/ForceCurveReviewQueue'
import { buildReviewQueue } from '@/lib/admin-force-curves'

export default async function Page() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/dashboard')

  const reviews = await prisma.forceCurveReviewCase.findMany({
    include: { masterSwitch: { select: { id: true, name: true, manufacturer: true, technology: true, type: true } }, catalogEntry: true },
    orderBy: { createdAt: 'asc' },
  })
  const ids = [...new Set(reviews.flatMap(review => typeof review.payload === 'object' && review.payload && !Array.isArray(review.payload) && Array.isArray((review.payload as { candidateIds?: unknown }).candidateIds) ? (review.payload as { candidateIds: string[] }).candidateIds : []))]
  const candidates = await prisma.forceCurveCatalogEntry.findMany({ where: { id: { in: ids }, exists: true } })
  const enriched = reviews.map(review => {
    const candidateIds = typeof review.payload === 'object' && review.payload && !Array.isArray(review.payload) && Array.isArray((review.payload as { candidateIds?: unknown }).candidateIds) ? (review.payload as { candidateIds: string[] }).candidateIds : []
    return { ...review, candidates: candidates.filter(candidate => candidateIds.includes(candidate.id)) }
  })

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link href="/admin" className="inline-flex min-h-11 items-center text-sm font-medium text-blue-600 hover:text-blue-500 focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-blue-400 dark:hover:text-blue-300">← Back to Admin Dashboard</Link>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl dark:text-white">Force Curve Review Queue</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600 sm:text-base dark:text-gray-400">Review imported force curve sources, resolve conflicts, and attach exact MasterSwitch records.</p>
          </div>
        </div>
        <ForceCurveReviewQueue initialQueue={buildReviewQueue(enriched)} />
      </div>
    </main>
  )
}
