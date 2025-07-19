import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import HamburgerMenu from "@/components/HamburgerMenu"

export default async function AdminDashboard() {
  const session = await auth()
  
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect("/dashboard")
  }

  // Get user data and statistics
  const [user, totalUsers, totalSwitches, usersLast30Days, switchesLast30Days, pendingSubmissions] = await Promise.all([
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { shareableId: true }
    }),
    prisma.user.count(),
    prisma.switch.count(),
    prisma.user.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    }),
    prisma.switch.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        }
      }
    }),
    prisma.masterSwitch.count({
      where: {
        status: 'PENDING'
      }
    })
  ])

  // Get top collectors
  const topCollectors = await prisma.user.findMany({
    select: {
      id: true,
      username: true,
      email: true,
      _count: {
        select: { switches: true }
      }
    },
    orderBy: {
      switches: {
        _count: 'desc'
      }
    },
    take: 5
  })

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Dashboard</h1>
            <Link
              href="/dashboard"
              className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
            >
              ← Back to My Collection
            </Link>
          </div>
          <HamburgerMenu 
            shareableId={user?.shareableId || ''} 
            isAdmin={true} 
          />
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Users</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{totalUsers}</dd>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{usersLast30Days} new in last 30 days</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Total Switches</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{totalSwitches}</dd>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{switchesLast30Days} new in last 30 days</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Average per User</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                {totalUsers > 0 ? (totalSwitches / totalUsers).toFixed(1) : 0}
              </dd>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Active Collections</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                {topCollectors.filter(u => u._count.switches > 0).length}
              </dd>
            </div>
          </div>
        </div>

        {/* Top Collectors */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Top Collectors</h2>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {topCollectors.map((user) => (
                <li key={user.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">{user.username}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-900 dark:text-white">
                      {user._count.switches} switches
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/users"
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Manage Users</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                View all users, reset passwords, and manage accounts
              </p>
            </div>
          </Link>

          <Link
            href="/admin/manufacturers"
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Manage Manufacturers</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Review, verify, and merge manufacturer entries
              </p>
            </div>
          </Link>

          <Link
            href="/admin/materials"
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Manage Materials</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Add, edit, and manage switch material options
              </p>
            </div>
          </Link>

          <Link
            href="/admin/stem-shapes"
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Manage Stem Shapes</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Add, edit, and manage stem shape options
              </p>
            </div>
          </Link>

          <Link
            href="/admin/stats"
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">Detailed Statistics</h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                View detailed analytics and usage statistics
              </p>
            </div>
          </Link>

          <Link
            href="/admin/master-switches"
            className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="px-4 py-5 sm:p-6 relative">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Master Switch Submissions
                {pendingSubmissions > 0 && (
                  <span className="ml-2 bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full text-xs">
                    {pendingSubmissions} pending
                  </span>
                )}
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Review and approve community switch submissions
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}