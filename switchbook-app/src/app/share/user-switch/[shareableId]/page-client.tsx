'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Switch, SwitchImage, User } from '@prisma/client'
import { SWITCH_TYPE_COLORS, SWITCH_TECHNOLOGY_COLORS } from '@/constants/switchTypes'
import ForceCurvesButton from '@/components/ForceCurvesButton'
import SwitchScoresButton from '@/components/SwitchScoresButton'
import ImageCarousel from '@/components/ImageCarousel'
import FrankenIndicator from '@/components/FrankenIndicator'
import { formatWithUnit } from '@/utils/formatters'
import { linkify } from '@/utils/linkify'

interface UserSwitchWithRelations extends Switch {
  user: Pick<User, 'username' | 'id'>
  images: SwitchImage[]
}

export default function ShareUserSwitchPageClient() {
  const params = useParams()
  const shareableId = params.shareableId as string
  
  const [switchItem, setSwitchItem] = useState<UserSwitchWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchSwitch = async () => {
      try {
        const response = await fetch(`/api/share/user-switch/${shareableId}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('Switch not found')
          } else {
            setError('Failed to load switch')
          }
          return
        }
        const data = await response.json()
        setSwitchItem(data)
      } catch (err) {
        setError('Failed to load switch')
      } finally {
        setLoading(false)
      }
    }

    fetchSwitch()
  }, [shareableId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !switchItem) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {error || 'Switch not found'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This switch may have been removed or the link is invalid.
          </p>
        </div>
      </div>
    )
  }

  const switchName = switchItem.name || switchItem.chineseName || 'Unknown Switch'
  const fullName = switchItem.manufacturer ? `${switchItem.manufacturer} ${switchName}` : switchName

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Login/Signup */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Switchbook</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">The mechanical keyboard switch database</p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm text-gray-700 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
            >
              Sign Up
            </Link>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          {/* Switch Header */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                  {fullName}
                  {switchItem.masterSwitchId && (
                    <span 
                      className="inline-flex items-center justify-center w-8 h-8 bg-purple-600 text-white text-sm font-bold rounded-full"
                      title="Linked to Master Database"
                    >
                      M
                    </span>
                  )}
                  {(switchItem.frankenTop || switchItem.frankenBottom || switchItem.frankenStem) && (
                    <FrankenIndicator className="inline-flex items-center justify-center w-8 h-8 bg-gray-500 text-white text-sm font-bold rounded-full" />
                  )}
                </h1>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  From {switchItem.user.username}&apos;s collection
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {switchItem.type && (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${SWITCH_TYPE_COLORS[switchItem.type as keyof typeof SWITCH_TYPE_COLORS]}`}>
                    {switchItem.type.replace('_', ' ')}
                  </span>
                )}
                {switchItem.technology && (
                  <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${SWITCH_TECHNOLOGY_COLORS[switchItem.technology as keyof typeof SWITCH_TECHNOLOGY_COLORS]}`}>
                    {switchItem.technology}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Switch Image and Details */}
          <div className="grid md:grid-cols-2 gap-6 p-6">
            {/* Image Section */}
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg overflow-hidden h-96 flex items-center justify-center">
              <ImageCarousel
                images={switchItem.images || []}
                alt={fullName}
                isHovered={true}
                className="w-full h-full"
              />
            </div>

            {/* Details Section */}
            <div className="space-y-4">
              {/* Materials */}
              {(switchItem.topHousing || switchItem.bottomHousing || switchItem.stem) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                    Materials
                  </h3>
                  <div className="space-y-1">
                    {switchItem.topHousing && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Top Housing:</span> {switchItem.topHousing}
                      </p>
                    )}
                    {switchItem.bottomHousing && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Bottom Housing:</span> {switchItem.bottomHousing}
                      </p>
                    )}
                    {switchItem.stem && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Stem:</span> {switchItem.stem}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Franken parts */}
              {(switchItem.frankenTop || switchItem.frankenBottom || switchItem.frankenStem) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                    Franken Parts
                  </h3>
                  <div className="space-y-1">
                    {switchItem.frankenTop && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Top Housing:</span> {switchItem.frankenTop}
                      </p>
                    )}
                    {switchItem.frankenBottom && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Bottom Housing:</span> {switchItem.frankenBottom}
                      </p>
                    )}
                    {switchItem.frankenStem && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Stem:</span> {switchItem.frankenStem}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Specifications */}
              {(switchItem.actuationForce || switchItem.bottomOutForce || switchItem.preTravel || switchItem.bottomOut) && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                    Specifications
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {switchItem.initialForce && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Initial Force:</span> {switchItem.initialForce}g
                      </p>
                    )}
                    {switchItem.actuationForce && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Actuation:</span> {switchItem.actuationForce}g
                      </p>
                    )}
                    {switchItem.tactileForce && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Tactile Force:</span> {switchItem.tactileForce}g
                      </p>
                    )}
                    {switchItem.tactilePosition && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Tactile Position:</span> {switchItem.tactilePosition}mm
                      </p>
                    )}
                    {switchItem.bottomOutForce && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Bottom Out:</span> {switchItem.bottomOutForce}g
                      </p>
                    )}
                    {switchItem.preTravel && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Pre Travel:</span> {switchItem.preTravel}mm
                      </p>
                    )}
                    {switchItem.bottomOut && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Total Travel:</span> {switchItem.bottomOut}mm
                      </p>
                    )}
                    {switchItem.springWeight && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Spring:</span> {formatWithUnit(switchItem.springWeight, 'g')}
                      </p>
                    )}
                    {switchItem.springLength && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Spring Length:</span> {formatWithUnit(switchItem.springLength, 'mm')}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Notes */}
              {switchItem.notes && (
                <div>
                  {switchItem.masterSwitchId ? (
                    <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-md">
                      <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-1">
                        Master Database Notes
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {linkify(switchItem.notes)}
                      </p>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide mb-2">
                        Notes
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {linkify(switchItem.notes)}
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Personal Notes */}
              {switchItem.personalNotes && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md border border-blue-200 dark:border-blue-800">
                  <h3 className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide mb-1">
                    Personal Notes
                  </h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {linkify(switchItem.personalNotes)}
                  </p>
                </div>
              )}

              {/* Force Curves and Scorecards */}
              <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <ForceCurvesButton 
                  switchName={switchItem.name}
                  manufacturer={switchItem.manufacturer}
                  variant="button"
                  className="w-full justify-center"
                  isAuthenticated={false}
                />
                <SwitchScoresButton 
                  switchName={switchItem.name}
                  manufacturer={switchItem.manufacturer}
                  variant="button"
                  className="w-full justify-center"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Call to Action */}
        <div className="mt-8 text-center p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Want to track your own switch collection?
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            Join Switchbook to catalog your switches, discover new ones, and share with the community.
          </p>
          <Link
            href="/auth/register"
            className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
          >
            Create Your Collection
          </Link>
        </div>
      </div>
    </div>
  )
}