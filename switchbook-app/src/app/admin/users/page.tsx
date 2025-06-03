import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import UserManagementTable from "@/components/admin/UserManagementTable"

export default async function AdminUsersPage() {
  const session = await auth()
  
  if (!session?.user?.id || session.user.role !== 'ADMIN') {
    redirect("/dashboard")
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      emailVerified: true,
      createdAt: true,
      _count: {
        select: { switches: true }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">User Management</h1>
          <Link
            href="/admin"
            className="text-blue-600 hover:text-blue-500"
          >
            Back to Admin Dashboard
          </Link>
        </div>

        <div className="bg-white shadow rounded-lg">
          <UserManagementTable users={users} currentUserId={session.user.id} />
        </div>
      </div>
    </div>
  )
}