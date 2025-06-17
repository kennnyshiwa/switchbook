'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { formatDistanceToNow } from 'date-fns'

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
  actuationForce?: number
  bottomOutForce?: number
  preTravel?: number
  bottomOut?: number
  manufacturer?: string
  notes?: string
  imageUrl?: string
  topHousing?: string
  bottomHousing?: string
  stem?: string
  frankenTop?: string
  frankenBottom?: string
  frankenStem?: string
  inCollection: boolean
  userSwitchId?: string
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
}

export default function MasterSwitchDetailPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ submitted?: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [switchData, setSwitchData] = useState<MasterSwitchDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [showSubmittedMessage, setShowSubmittedMessage] = useState(false)

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
  }, [params, session, status, router])

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
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
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
              {switchData.inCollection ? (
                <>
                  <span className="text-green-600 dark:text-green-400">
                    ✓ In your collection
                  </span>
                  {switchData.userSwitchId && (
                    <Link
                      href="/dashboard"
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
                    >
                      View in Collection
                    </Link>
                  )}
                </>
              ) : (
                <button
                  onClick={addToCollection}
                  disabled={adding}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {adding ? 'Adding...' : 'Add to Collection'}
                </button>
              )}
              
              {switchData.status === 'APPROVED' && (
                <Link
                  href={`/switches/${switchData.id}/suggest-edit`}
                  className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
                >
                  Suggest Edit
                </Link>
              )}
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
          {switchData.imageUrl && (
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="relative mx-auto" style={{ maxWidth: '600px', height: '400px' }}>
                <Image
                  src={switchData.imageUrl}
                  alt={switchData.name}
                  fill
                  className="object-contain rounded-lg"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 600px"
                />
              </div>
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
            {(switchData.actuationForce || switchData.bottomOutForce || switchData.initialForce) && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Force Specifications
                </h2>
                <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
            {(switchData.topHousing || switchData.bottomHousing || switchData.stem) && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Materials
                </h2>
                <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                </dl>
              </div>
            )}

            {/* Spring */}
            {(switchData.springWeight || switchData.springLength) && (
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
                </dl>
              </div>
            )}

            {/* Magnetic Properties */}
            {switchData.technology === 'MAGNETIC' && (switchData.magnetOrientation || switchData.magnetPosition || switchData.magnetPolarity || switchData.initialMagneticFlux || switchData.bottomOutMagneticFlux || switchData.pcbThickness) && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Magnetic Properties
                </h2>
                <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                <dl className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
    </div>
  )
}