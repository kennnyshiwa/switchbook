import { redirect } from 'next/navigation'
import Link from 'next/link'
import { auth } from '@/lib/auth'
import IntegrationKeyManager from '@/components/admin/IntegrationKeyManager'

export const dynamic = 'force-dynamic'

export default async function AdminIntegrationsPage() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'ADMIN') redirect('/dashboard')
  return <main className="min-h-screen bg-gray-50 px-4 py-8 dark:bg-gray-900 dark:text-white sm:px-6">
    <div className="mx-auto max-w-6xl">
      <Link href="/admin" className="text-sm text-blue-600 dark:text-blue-400">← Admin dashboard</Link>
      <h1 className="mt-3 text-3xl font-bold">Integration API keys</h1>
      <p className="mb-6 mt-2 text-gray-600 dark:text-gray-300">Issue and manage catalog-only application credentials. Stored records contain hashes and non-secret metadata only.</p>
      <IntegrationKeyManager />
    </div>
  </main>
}
