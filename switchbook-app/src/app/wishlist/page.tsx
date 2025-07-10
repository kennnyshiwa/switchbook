'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Image from "next/image"
import Link from "next/link"
import HamburgerMenu from "@/components/HamburgerMenu"
import WishlistCollection from "@/components/WishlistCollection"
import NotificationBanner from "@/components/NotificationBanner"
import AddToWishlistForm from "@/components/AddToWishlistForm"

interface WishlistItem {
  id: string
  customName?: string
  customManufacturer?: string
  customNotes?: string
  priority: number
  createdAt: string
  masterSwitch?: {
    id: string
    name: string
    chineseName?: string
    type?: string
    technology?: string
    manufacturer?: string
    actuationForce?: number
    bottomOutForce?: number
    imageUrl?: string
    images?: Array<{ url: string }>
  }
}

export default function WishlistPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [userShareableId, setUserShareableId] = useState('')

  useEffect(() => {
    if (status === 'loading') return
    if (!session?.user?.id) {
      router.push('/auth/login')
      return
    }

    fetchWishlist()
  }, [session, status, router])

  const fetchWishlist = async () => {
    try {
      const response = await fetch('/api/wishlist')
      if (response.ok) {
        const data = await response.json()
        setWishlistItems(data)
      }
      
      // Fetch user data for shareable ID
      const userResponse = await fetch('/api/user/profile')
      if (userResponse.ok) {
        const userData = await userResponse.json()
        setUserShareableId(userData.shareableId || '')
      }
    } catch (error) {
      console.error('Failed to fetch wishlist:', error)
    } finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading wishlist...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            {/* Logo */}
            <Link href="/dashboard" className="flex-shrink-0">
              <Image
                className="h-16 w-auto"
                src="/logo.png"
                alt="Switchbook"
                width={200}
                height={64}
              />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Wishlist</h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Switches you want to collect
              </p>
            </div>
            {/* Back Button */}
            <Link
              href="/dashboard"
              className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 ml-8"
            >
              ← Back to Dashboard
            </Link>
          </div>
          
          <div className="flex items-center space-x-4">
            <Link 
              href="/switches/browse" 
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Browse Master Switches
            </Link>
            <button
              onClick={() => setShowAddForm(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-purple-600 hover:bg-purple-700"
            >
              <svg className="-ml-1 mr-2 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Add Switch
            </button>
            <HamburgerMenu 
              shareableId={userShareableId}
              isAdmin={session?.user?.role === 'ADMIN'}
            />
          </div>
        </div>

        <NotificationBanner userId={session?.user?.id || ''} />

        <WishlistCollection items={wishlistItems} />

        {showAddForm && (
          <AddToWishlistForm 
            onClose={() => {
              setShowAddForm(false)
              fetchWishlist()
            }}
          />
        )}
      </div>
    </div>
  )
}