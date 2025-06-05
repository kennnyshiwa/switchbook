import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"

export default async function AdminStats() {
  const session = await auth()
  
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect("/dashboard")
  }

  // Get detailed statistics
  const [
    totalUsers,
    totalSwitches,
    verifiedUsers,
    usersWithSwitches,
    mostPopularSwitchTypes,
    mostPopularManufacturers,
    recentActivity,
    userGrowthLast7Days,
    switchGrowthLast7Days
  ] = await Promise.all([
    // Basic counts
    prisma.user.count(),
    prisma.switch.count(),
    
    // User stats
    prisma.user.count({ where: { emailVerified: { not: null } } }),
    prisma.user.count({ 
      where: { 
        switches: { 
          some: {} 
        } 
      } 
    }),
    
    // Switch type popularity
    prisma.switch.groupBy({
      by: ['type'],
      _count: { type: true },
      orderBy: { _count: { type: 'desc' } },
      take: 5
    }),
    
    // Manufacturer popularity
    prisma.switch.groupBy({
      by: ['manufacturer'],
      where: { manufacturer: { not: null } },
      _count: { manufacturer: true },
      orderBy: { _count: { manufacturer: 'desc' } },
      take: 10
    }),
    
    // Recent activity
    prisma.switch.findMany({
      select: {
        name: true,
        type: true,
        manufacturer: true,
        createdAt: true,
        user: {
          select: { username: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    }),
    
    // Growth metrics
    Promise.all(Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const startOfDay = new Date(date.setHours(0, 0, 0, 0))
      const endOfDay = new Date(date.setHours(23, 59, 59, 999))
      
      return prisma.user.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      })
    })),
    
    Promise.all(Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const startOfDay = new Date(date.setHours(0, 0, 0, 0))
      const endOfDay = new Date(date.setHours(23, 59, 59, 999))
      
      return prisma.switch.count({
        where: {
          createdAt: {
            gte: startOfDay,
            lte: endOfDay
          }
        }
      })
    }))
  ])

  const engagementRate = totalUsers > 0 ? ((usersWithSwitches / totalUsers) * 100).toFixed(1) : 0
  const verificationRate = totalUsers > 0 ? ((verifiedUsers / totalUsers) * 100).toFixed(1) : 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Detailed Statistics</h1>
          <Link
            href="/admin"
            className="text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Back to Admin Dashboard
          </Link>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">User Engagement</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{engagementRate}%</dd>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{usersWithSwitches} of {totalUsers} users have switches</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Email Verification</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">{verificationRate}%</dd>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{verifiedUsers} verified users</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Avg. Collection Size</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                {usersWithSwitches > 0 ? (totalSwitches / usersWithSwitches).toFixed(1) : 0}
              </dd>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">switches per active user</p>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400 truncate">Growth Today</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900 dark:text-white">
                +{userGrowthLast7Days[0]} users
              </dd>
              <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">+{switchGrowthLast7Days[0]} switches</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Switch Type Popularity */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Most Popular Switch Types</h2>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {mostPopularSwitchTypes.map((type) => (
                  <li key={type.type || 'no-type'} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {type.type ? type.type.replace('_', ' ') : 'No Type'}
                      </div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {type._count.type} switches
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Manufacturer Popularity */}
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Top Manufacturers</h2>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700">
              <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                {mostPopularManufacturers.map((manufacturer) => (
                  <li key={manufacturer.manufacturer} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {manufacturer.manufacturer}
                      </div>
                      <div className="text-sm text-gray-900 dark:text-white">
                        {manufacturer._count.manufacturer} switches
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Weekly Growth Chart Data */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">User Growth (Last 7 Days)</h2>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4">
              {userGrowthLast7Days.reverse().map((count, index) => {
                const date = new Date()
                date.setDate(date.getDate() - (6 - index))
                return (
                  <div key={index} className="flex justify-between py-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {date.toLocaleDateString()}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      +{count} users
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg font-medium text-gray-900 dark:text-white">Switch Growth (Last 7 Days)</h2>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-700 px-4 py-4">
              {switchGrowthLast7Days.reverse().map((count, index) => {
                const date = new Date()
                date.setDate(date.getDate() - (6 - index))
                return (
                  <div key={index} className="flex justify-between py-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {date.toLocaleDateString()}
                    </span>
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      +{count} switches
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg font-medium text-gray-900 dark:text-white">Recent Activity</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Latest switches added to collections</p>
          </div>
          <div className="border-t border-gray-200 dark:border-gray-700">
            <ul className="divide-y divide-gray-200 dark:divide-gray-700">
              {recentActivity.map((activity, index) => (
                <li key={index} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {activity.name}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {activity.type ? activity.type.replace('_', ' ') : 'No Type'} • {activity.manufacturer || 'Unknown'} • by {activity.user.username}
                      </p>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(activity.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}