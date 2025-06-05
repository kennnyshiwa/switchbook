import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import SwitchCollection from "@/components/SwitchCollection"
import CollectionStats from "@/components/CollectionStats"
import HamburgerMenu from "@/components/HamburgerMenu"

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
          <HamburgerMenu 
            shareableId={user.shareableId} 
            isAdmin={user.role === 'ADMIN'} 
          />
        </div>

        {user.switches.length > 0 && (
          <div className="mb-8">
            <CollectionStats switches={user.switches} />
          </div>
        )}

        <SwitchCollection 
          switches={user.switches} 
          userId={user.id}
          showForceCurves={user.showForceCurves}
        />
      </div>
    </div>
  )
}