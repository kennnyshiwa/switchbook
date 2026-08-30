import Link from 'next/link'
import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import ForceCurveReviewQueue from '@/components/admin/ForceCurveReviewQueue'
import { getForceCurveReviewQueuePage } from '@/lib/admin-force-curve-queue'

export default async function Page() {
  const session = await auth()
  if (session?.user?.role !== 'ADMIN') redirect('/dashboard')

  const queue = await getForceCurveReviewQueuePage({}, prisma)

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
        <ForceCurveReviewQueue initialQueue={queue} rankAssistEnabled={process.env.FORCE_CURVE_RANK_ASSIST_ENABLED === 'true'} />
      </div>
    </main>
  )
}
