'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import WishlistDetailsPopup from './WishlistDetailsPopup'

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
    preTravel?: number
    bottomOut?: number
    springWeight?: string
    springLength?: string
    notes?: string
    imageUrl?: string
    images?: Array<{ url: string }>
    topHousing?: string
    bottomHousing?: string
    stem?: string
    magnetOrientation?: string
    magnetPosition?: string
    magnetPolarity?: string
    initialForce?: number
    initialMagneticFlux?: number
    bottomOutMagneticFlux?: number
    pcbThickness?: string
    compatibility?: string
    progressiveSpring?: boolean
    doubleStage?: boolean
    clickType?: string
    tactileForce?: number
    tactilePosition?: string
  }
}

interface WishlistCollectionProps {
  items: WishlistItem[]
}

export default function WishlistCollection({ items }: WishlistCollectionProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [movingId, setMovingId] = useState<string | null>(null)
  const [selectedItem, setSelectedItem] = useState<WishlistItem | null>(null)
  const [processedItems, setProcessedItems] = useState<Set<string>>(new Set())
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const deleteFromWishlist = async (id: string) => {
    if (!confirm('Are you sure you want to remove this from your wishlist?')) {
      return
    }

    setDeletingId(id)
    try {
      const response = await fetch(`/api/wishlist/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        setSelectedItem(null)
        setProcessedItems(prev => new Set(prev).add(id))
        setSuccessMessage('Successfully removed from wishlist!')
        
        // Clear success message and refresh after a short delay
        setTimeout(() => {
          setSuccessMessage(null)
          router.refresh()
        }, 2000)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to remove from wishlist')
      }
    } catch (error) {
      console.error('Failed to delete:', error)
      alert('Failed to remove from wishlist')
    } finally {
      setDeletingId(null)
    }
  }

  const moveToCollection = async (id: string) => {
    setMovingId(id)
    try {
      const response = await fetch(`/api/wishlist/${id}/move-to-collection`, {
        method: 'POST',
      })

      if (response.ok) {
        setSelectedItem(null)
        setProcessedItems(prev => new Set(prev).add(id))
        setSuccessMessage('Successfully added to collection!')
        
        // Clear success message and refresh after a short delay
        setTimeout(() => {
          setSuccessMessage(null)
          router.refresh()
        }, 2000)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to move to collection')
      }
    } catch (error) {
      console.error('Failed to move:', error)
      alert('Failed to move to collection')
    } finally {
      setMovingId(null)
    }
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <svg
          className="mx-auto h-12 w-12 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
          No items in your wishlist
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Start by browsing master switches and adding them to your wishlist.
        </p>
        <div className="mt-6">
          <Link
            href="/switches/browse"
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Browse Master Switches
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow relative">
      {/* Success Message */}
      {successMessage && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg flex items-center">
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {successMessage}
        </div>
      )}
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-6">
        {items.map((item) => {
          const isCustom = !item.masterSwitch
          const name = item.customName || item.masterSwitch?.name || 'Unnamed Switch'
          const manufacturer = item.customManufacturer || item.masterSwitch?.manufacturer
          const imageUrl = item.masterSwitch?.imageUrl || item.masterSwitch?.images?.[0]?.url

          const isProcessed = processedItems.has(item.id)

          return (
            <div key={item.id} className={`group transition-opacity duration-500 ${isProcessed ? 'opacity-30' : ''}`}>
              <div 
                className="relative aspect-square bg-gray-100 dark:bg-gray-900 rounded-lg overflow-hidden mb-2 border-2 border-transparent hover:border-purple-500 dark:hover:border-purple-400 transition-all duration-200 cursor-pointer"
                onClick={() => !isProcessed && setSelectedItem(item)}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={name}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-16 h-16 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                )}
                {isCustom && (
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-purple-600 text-white text-xs rounded">
                    Custom
                  </div>
                )}
                {!isProcessed && (
                  <div className="absolute bottom-1 right-1 flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        moveToCollection(item.id)
                      }}
                      disabled={movingId === item.id}
                      className="bg-green-500 hover:bg-green-600 text-white p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Add to Collection"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        deleteFromWishlist(item.id)
                      }}
                      disabled={deletingId === item.id}
                      className="bg-red-500 hover:bg-red-600 text-white p-1 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Remove from Wishlist"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
              
              <div className="text-center">
                <h3 
                  className={`text-sm font-medium text-gray-900 dark:text-white transition-colors ${!isProcessed ? 'cursor-pointer group-hover:text-purple-600 dark:group-hover:text-purple-400' : ''}`}
                  onClick={() => !isProcessed && setSelectedItem(item)}
                >
                  {name}
                </h3>
                {manufacturer && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {manufacturer}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
      
      {/* Wishlist Details Popup */}
      {selectedItem && (
        <WishlistDetailsPopup
          item={selectedItem}
          onClose={() => setSelectedItem(null)}
          onMoveToCollection={moveToCollection}
          onDelete={deleteFromWishlist}
          isMoving={movingId === selectedItem.id}
          isDeleting={deletingId === selectedItem.id}
        />
      )}
    </div>
  )
}