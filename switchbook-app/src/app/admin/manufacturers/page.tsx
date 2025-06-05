import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import ManufacturerManagement from '@/components/admin/ManufacturerManagement'

export default async function AdminManufacturersPage() {
  const session = await auth()
  
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manufacturer Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Review, verify, and merge manufacturer entries
          </p>
        </div>

        <ManufacturerManagement />
      </div>
    </div>
  )
}