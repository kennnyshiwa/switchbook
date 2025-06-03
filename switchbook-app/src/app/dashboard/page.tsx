import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import Link from "next/link"
import SwitchCollection from "@/components/SwitchCollection"
import CollectionStats from "@/components/CollectionStats"
import ShareButton from "@/components/ShareButton"
import SignOutButton from "@/components/SignOutButton"
import ThemeToggle from "@/components/ThemeToggle"

export default async function DashboardPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/login")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: {
      switches: {
        orderBy: { createdAt: "desc" }
      }
    }
  })

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">My Switch Collection</h1>
            <p className="text-gray-600 dark:text-gray-300 mt-1">Welcome back, {user.username}!</p>
          </div>
          <div className="flex items-center space-x-4">
            <ThemeToggle />
            <ShareButton shareableId={user.shareableId} />
            {user.role === 'ADMIN' && (
              <Link
                href="/admin"
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700"
              >
                Admin Panel
              </Link>
            )}
            <Link
              href="/settings"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Settings
            </Link>
            <SignOutButton />
          </div>
        </div>

        {user.switches.length > 0 && (
          <div className="mb-8">
            <CollectionStats switches={user.switches} />
          </div>
        )}

        <SwitchCollection 
          switches={user.switches} 
          userId={user.id}
        />
      </div>
    </div>
  )
}