import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function AdminDashboard() {
  const session = await auth()
  
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect("/dashboard")
  }

  // Get statistics
  const [totalUsers, totalSwitches, usersLast30Days, switchesLast30Days] = await Promise.all([
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <Link
            href="/dashboard"
            className="text-blue-600 hover:text-blue-500"
          >
            Back to My Collection
          </Link>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Total Users</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{totalUsers}</dd>
              <p className="mt-2 text-sm text-gray-600">{usersLast30Days} new in last 30 days</p>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Total Switches</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{totalSwitches}</dd>
              <p className="mt-2 text-sm text-gray-600">{switchesLast30Days} new in last 30 days</p>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Average per User</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                {totalUsers > 0 ? (totalSwitches / totalUsers).toFixed(1) : 0}
              </dd>
            </div>
          </div>

          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Active Collections</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">
                {topCollectors.filter(u => u._count.switches > 0).length}
              </dd>
            </div>
          </div>
        </div>

        {/* Top Collectors */}
        <div className="bg-white shadow rounded-lg mb-8">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900">Top Collectors</h2>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {topCollectors.map((user) => (
                <li key={user.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{user.username}</p>
                        <p className="text-sm text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-sm text-gray-900">
                      {user._count.switches} switches
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Link
            href="/admin/users"
            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900">Manage Users</h3>
              <p className="mt-1 text-sm text-gray-500">
                View all users, reset passwords, and manage accounts
              </p>
            </div>
          </Link>

          <Link
            href="/admin/stats"
            className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow"
          >
            <div className="px-4 py-5 sm:p-6">
              <h3 className="text-lg font-medium text-gray-900">Detailed Statistics</h3>
              <p className="mt-1 text-sm text-gray-500">
                View detailed analytics and usage statistics
              </p>
            </div>
          </Link>
        </div>
      </div>
    </div>
  )
}