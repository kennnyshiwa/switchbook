'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'
import LinkToCollectionDialog from '@/components/LinkToCollectionDialog'

interface MasterSwitchDetail {
  id: string
  name: string
  chineseName?: string
  type?: string
  technology?: string
  magnetOrientation?: string
  magnetPosition?: string
  magnetPolarity?: string
  initialForce?: number
  initialMagneticFlux?: number
  bottomOutMagneticFlux?: number
  pcbThickness?: string
  compatibility?: string
  springWeight?: string
  springLength?: string
  progressiveSpring?: boolean
  doubleStage?: boolean
  clickType?: string
  actuationForce?: number
  tactileForce?: number
  tactilePosition?: string
  bottomOutForce?: number
  preTravel?: number
  bottomOut?: number
  manufacturer?: string
  notes?: string
  imageUrl?: string
  topHousing?: string
  bottomHousing?: string
  stem?: string
  topHousingColor?: string
  bottomHousingColor?: string
  stemColor?: string
  stemShape?: string
  markings?: string
  frankenTop?: string
  frankenBottom?: string
  frankenStem?: string
  inCollection: boolean
  userSwitchId?: string
  inWishlist: boolean
  wishlistId?: string
  userCount: number
  viewCount: number
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  createdAt: string
  submittedBy: {
    id: string
    username: string
  }
  approvedBy?: {
    id: string
    username: string
  }
  approvedAt?: string
  shareableId?: string
}

export default function MasterSwitchDetailPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ submitted?: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [switchData, setSwitchData] = useState<MasterSwitchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [addingToWishlist, setAddingToWishlist] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [showSubmittedMessage, setShowSubmittedMessage] = useState(false)
  const [showLinkDialog, setShowLinkDialog] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/login')
      return
    }

    const fetchSwitch = async () => {
      try {
        const { id } = await params
        const resolvedSearchParams = await searchParams
        if (resolvedSearchParams?.submitted === 'true') {
          setShowSubmittedMessage(true)
        }
        
        const response = await fetch(`/api/master-switches/${id}`)
        if (response.ok) {
          const data = await response.json()
          setSwitchData(data)
        } else {
          router.push('/switches/browse')
        }
      } catch (error) {
        console.error('Failed to fetch switch:', error)
        router.push('/switches/browse')
      } finally {
        setLoading(false)
      }
    }

    fetchSwitch()
  }, [params, searchParams, session, status, router])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const addToCollection = async () => {
    if (!switchData) return
    
    setAdding(true)
    try {
      const response = await fetch(`/api/master-switches/${switchData.id}/add-to-collection`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        setSwitchData(prev => prev ? { ...prev, inCollection: true, userSwitchId: data.switchId } : null)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add switch to collection')
      }
    } catch (error) {
      console.error('Failed to add switch:', error)
      alert('Failed to add switch to collection')
    } finally {
      setAdding(false)
    }
  }

  const addToWishlist = async () => {
    if (!switchData) return
    
    setAddingToWishlist(true)
    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterSwitchId: switchData.id,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setSwitchData(prev => prev ? { ...prev, inWishlist: true, wishlistId: data.id } : null)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add switch to wishlist')
      }
    } catch (error) {
      console.error('Failed to add to wishlist:', error)
      alert('Failed to add switch to wishlist')
    } finally {
      setAddingToWishlist(false)
    }
  }

  const deleteSwitch = async () => {
    if (!switchData) return
    
    if (!confirm('Are you sure you want to delete this master switch? This action cannot be undone.')) {
      return
    }

    setDeleting(true)
    try {
      const response = await fetch(`/api/admin/master-switches/${switchData.id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        router.push('/switches/browse')
      } else {
        alert(data.error || 'Failed to delete switch')
      }
    } catch (error) {
      console.error('Failed to delete switch:', error)
      alert('Failed to delete switch')
    } finally {
      setDeleting(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading switch details...</p>
        </div>
      </div>
    )
  }

  if (!switchData) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Success Message */}
        {showSubmittedMessage && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/50 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                  Switch submitted successfully!
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Your submission is pending review by our moderators. This typically takes 24-48 hours.
                </p>
              </div>
              <button
                onClick={() => setShowSubmittedMessage(false)}
                className="ml-auto text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        )}
        
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/switches/browse"
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4 inline-block"
          >
            ← Back to Browse
          </Link>
          
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {switchData.name}
                </h1>
                {switchData.status === 'PENDING' && (
                  <span className="px-3 py-1 text-sm font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200 rounded-full">
                    Pending Review
                  </span>
                )}
                {switchData.status === 'REJECTED' && (
                  <span className="px-3 py-1 text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 rounded-full">
                    Rejected
                  </span>
                )}
              </div>
              {switchData.chineseName && (
                <p className="text-xl text-gray-600 dark:text-gray-400 mt-1">
                  {switchData.chineseName}
                </p>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              {switchData.inCollection && (
                <span className="text-green-600 dark:text-green-400 flex items-center">
                  <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  In collection
                </span>
              )}
              
              {switchData.inWishlist && !switchData.inCollection && (
                <span className="text-purple-600 dark:text-purple-400 flex items-center">
                  <svg className="w-5 h-5 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                  </svg>
                  In wishlist
                </span>
              )}
              
              {!switchData.inWishlist && !switchData.inCollection && (
                <button
                  onClick={addToWishlist}
                  disabled={addingToWishlist}
                  className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {addingToWishlist ? 'Adding...' : 'Add to Wishlist'}
                </button>
              )}
              
              {!switchData.inCollection && (
                <button
                  onClick={addToCollection}
                  disabled={adding}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? 'Adding...' : 'Add to Collection'}
                </button>
              )}
              
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="p-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
                  aria-label="More options"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
                  </svg>
                </button>
                
                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
                    <div className="py-1">
                      {switchData.inCollection && switchData.userSwitchId && (
                        <Link
                          href="/dashboard"
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => setShowDropdown(false)}
                        >
                          View in Collection
                        </Link>
                      )}
                      
                      {!switchData.inCollection && (
                        <button
                          onClick={() => {
                            setShowLinkDialog(true)
                            setShowDropdown(false)
                          }}
                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        >
                          Link to Collection
                        </button>
                      )}
                      
                      {switchData.inWishlist && switchData.wishlistId && (
                        <Link
                          href="/wishlist"
                          className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => setShowDropdown(false)}
                        >
                          View in Wishlist
                        </Link>
                      )}
                      
                      {switchData.status === 'APPROVED' && (
                        <>
                          <button
                            onClick={async () => {
                              const shareUrl = `${window.location.origin}/share/switch/${switchData.shareableId}`
                              try {
                                await navigator.clipboard.writeText(shareUrl)
                                alert('Share link copied to clipboard!')
                              } catch (err) {
                                console.error('Failed to copy:', err)
                              }
                              setShowDropdown(false)
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            disabled={!switchData.shareableId}
                          >
                            Copy Share Link
                          </button>
                          <Link
                            href={`/switches/${switchData.id}/suggest-edit`}
                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => setShowDropdown(false)}
                          >
                            Suggest Edit
                          </Link>
                          <Link
                            href={`/switches/${switchData.id}/history`}
                            className="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            onClick={() => setShowDropdown(false)}
                          >
                            View History
                          </Link>
                        </>
                      )}
                      
                      {session?.user?.role === 'ADMIN' && (
                        <>
                          <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
                          <button
                            onClick={() => {
                              deleteSwitch()
                              setShowDropdown(false)
                            }}
                            disabled={deleting}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {deleting ? 'Deleting...' : 'Delete Switch'}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-4 flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
            <span>Submitted by {switchData.submittedBy.username}</span>
            <span>•</span>
            <span>{switchData.viewCount} views</span>
            <span>•</span>
            <span>Used by {switchData.userCount} {switchData.userCount === 1 ? 'person' : 'people'}</span>
            <span>•</span>
            <span>Added {formatDistanceToNow(new Date(switchData.createdAt))} ago</span>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          {/* Image Section */}
          {switchData.imageUrl && (
            <div className="relative h-96 bg-gray-100 dark:bg-gray-900">
              <img
                src={switchData.imageUrl}
                alt={switchData.name}
                className="w-full h-full object-contain"
              />
            </div>
          )}

          <div className="p-6 space-y-6">
            {/* Basic Information */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Basic Information
              </h2>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {switchData.manufacturer && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Manufacturer</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{switchData.manufacturer}</dd>
                  </div>
                )}
                {switchData.type && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{switchData.type.replace('_', ' ')}</dd>
                  </div>
                )}
                {switchData.technology && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Technology</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{switchData.technology.replace('_', ' ')}</dd>
                  </div>
                )}
                {switchData.compatibility && (
                  <div>
                    <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Compatibility</dt>
                    <dd className="text-sm text-gray-900 dark:text-white">{switchData.compatibility}</dd>
                  </div>
                )}
              </dl>
            </div>

            {/* Force Specifications */}
            {(switchData.actuationForce || switchData.tactileForce || switchData.bottomOutForce || switchData.initialForce) && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Force Specifications
                </h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {switchData.initialForce && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Initial Force</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.initialForce}g</dd>
                    </div>
                  )}
                  {switchData.actuationForce && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Actuation Force</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.actuationForce}g</dd>
                    </div>
                  )}
                  {switchData.tactileForce && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Tactile Force</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.tactileForce}g</dd>
                    </div>
                  )}
                  {switchData.tactilePosition && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Tactile Position</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.tactilePosition}mm</dd>
                    </div>
                  )}
                  {switchData.bottomOutForce && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Bottom Out Force</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.bottomOutForce}g</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Travel Distances */}
            {(switchData.preTravel || switchData.bottomOut) && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Travel Distances
                </h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {switchData.preTravel && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Pre-travel</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.preTravel}mm</dd>
                    </div>
                  )}
                  {switchData.bottomOut && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Travel</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.bottomOut}mm</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Materials */}
            {(switchData.topHousing || switchData.bottomHousing || switchData.stem || switchData.topHousingColor || switchData.bottomHousingColor || switchData.stemColor || switchData.stemShape) && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Materials
                </h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {switchData.topHousing && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Top Housing</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.topHousing}</dd>
                    </div>
                  )}
                  {switchData.bottomHousing && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Bottom Housing</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.bottomHousing}</dd>
                    </div>
                  )}
                  {switchData.stem && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Stem</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.stem}</dd>
                    </div>
                  )}
                  {switchData.topHousingColor && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Top Housing Color</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.topHousingColor}</dd>
                    </div>
                  )}
                  {switchData.bottomHousingColor && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Bottom Housing Color</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.bottomHousingColor}</dd>
                    </div>
                  )}
                  {switchData.stemColor && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Stem Color</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.stemColor}</dd>
                    </div>
                  )}
                  {switchData.stemShape && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Stem Shape</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.stemShape}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Spring */}
            {(switchData.springWeight || switchData.springLength || switchData.progressiveSpring || switchData.doubleStage || (switchData.type === 'CLICKY' && switchData.clickType)) && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Spring
                </h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {switchData.springWeight && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Spring Weight</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.springWeight}</dd>
                    </div>
                  )}
                  {switchData.springLength && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Spring Length</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.springLength}</dd>
                    </div>
                  )}
                  {switchData.progressiveSpring && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Progressive Spring</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">Yes</dd>
                    </div>
                  )}
                  {switchData.doubleStage && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Double Stage</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">Yes</dd>
                    </div>
                  )}
                  {switchData.type === 'CLICKY' && switchData.clickType && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Click Type</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.clickType.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Magnetic Properties */}
            {switchData.technology === 'MAGNETIC' && (switchData.magnetOrientation || switchData.magnetPosition || switchData.magnetPolarity || switchData.initialMagneticFlux || switchData.bottomOutMagneticFlux || switchData.pcbThickness) && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Magnetic Properties
                </h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {switchData.magnetOrientation && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Magnet Orientation</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.magnetOrientation}</dd>
                    </div>
                  )}
                  {switchData.magnetPosition && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Magnet Position</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.magnetPosition}</dd>
                    </div>
                  )}
                  {switchData.magnetPolarity && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Magnet Polarity</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.magnetPolarity}</dd>
                    </div>
                  )}
                  {switchData.initialMagneticFlux && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Initial Magnetic Flux</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.initialMagneticFlux} Gs</dd>
                    </div>
                  )}
                  {switchData.bottomOutMagneticFlux && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Bottom Out Magnetic Flux</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.bottomOutMagneticFlux} Gs</dd>
                    </div>
                  )}
                  {switchData.pcbThickness && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">PCB Thickness</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.pcbThickness}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Frankenswitch */}
            {(switchData.frankenTop || switchData.frankenBottom || switchData.frankenStem) && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Frankenswitch Parts
                </h2>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {switchData.frankenTop && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Top</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.frankenTop}</dd>
                    </div>
                  )}
                  {switchData.frankenBottom && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Bottom</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.frankenBottom}</dd>
                    </div>
                  )}
                  {switchData.frankenStem && (
                    <div>
                      <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Stem</dt>
                      <dd className="text-sm text-gray-900 dark:text-white">{switchData.frankenStem}</dd>
                    </div>
                  )}
                </dl>
              </div>
            )}

            {/* Markings */}
            {switchData.markings && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Markings
                </h2>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                  {switchData.markings}
                </p>
              </div>
            )}

            {/* Notes */}
            {switchData.notes && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Notes
                </h2>
                <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">
                  {switchData.notes}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Link to Collection Dialog */}
      {showLinkDialog && switchData && (
        <LinkToCollectionDialog
          masterSwitchId={switchData.id}
          masterSwitchName={switchData.name}
          onClose={() => setShowLinkDialog(false)}
          onSuccess={() => {
            setShowLinkDialog(false)
            // Refresh the page data to show the updated status
            window.location.reload()
          }}
        />
      )}
    </div>
  )
}