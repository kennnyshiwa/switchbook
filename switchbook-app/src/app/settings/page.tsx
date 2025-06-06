import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import AccountSettings from "@/components/AccountSettings"
import HamburgerMenu from "@/components/HamburgerMenu"

export default async function SettingsPage() {
  const session = await auth()
  
  if (!session?.user?.id) {
    redirect("/auth/login")
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      email: true,
      username: true,
      role: true,
      shareableId: true,
      showForceCurves: true,
      password: true,
      accounts: {
        select: {
          provider: true
        }
      },
      _count: {
        select: { switches: true }
      }
    }
  })

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Account Settings</h1>
          <HamburgerMenu 
            shareableId={user.shareableId} 
            isAdmin={user.role === 'ADMIN'} 
          />
        </div>
        
        <AccountSettings user={user} />
      </div>
    </div>
  )
}