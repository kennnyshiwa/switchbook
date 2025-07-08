'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { MasterSwitch, SwitchImage, User } from '@prisma/client'
import Image from 'next/image'
import { SWITCH_TYPE_COLORS, SWITCH_TECHNOLOGY_COLORS } from '@/constants/switchTypes'
import ForceCurvesButton from '@/components/ForceCurvesButton'

interface MasterSwitchWithRelations extends MasterSwitch {
  submittedBy: User
  images: SwitchImage[]
}

export default function ShareMasterSwitchPageClient() {
  const params = useParams()
  const shareableId = params.shareableId as string
  
  const [masterSwitch, setMasterSwitch] = useState<MasterSwitchWithRelations | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [imageError, setImageError] = useState(false)

  useEffect(() => {
    const fetchMasterSwitch = async () => {
      try {
        const response = await fetch(`/api/share/switch/${shareableId}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('Switch not found')
          } else {
            setError('Failed to load switch')
          }
          return
        }
        const data = await response.json()
        setMasterSwitch(data)
      } catch (err) {
        setError('Failed to load switch')
      } finally {
        setLoading(false)
      }
    }

    fetchMasterSwitch()
  }, [shareableId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !masterSwitch) {
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

  const primaryImage = masterSwitch.primaryImageId
    ? masterSwitch.images.find(img => img.id === masterSwitch.primaryImageId)
    : masterSwitch.images[0]

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
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {masterSwitch.manufacturer} {masterSwitch.name}
            </h1>
            {masterSwitch.chineseName && (
              <p className="text-lg text-gray-600 dark:text-gray-400 mt-1">{masterSwitch.chineseName}</p>
            )}
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              Submitted by {masterSwitch.submittedBy.username}
            </p>
          </div>

          {/* Image */}
          {(primaryImage || masterSwitch.imageUrl) && !imageError && (
            <div className="mb-6">
              <div className="relative aspect-square w-full max-w-md mx-auto rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-700">
                <Image
                  src={primaryImage?.url || masterSwitch.imageUrl || ''}
                  alt={`${masterSwitch.manufacturer} ${masterSwitch.name}`}
                  fill
                  className="object-contain"
                  onError={() => setImageError(true)}
                />
              </div>
            </div>
          )}

          {/* Type and Technology */}
          <div className="flex flex-wrap gap-2 mb-6">
            {masterSwitch.type && (
              <span 
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  SWITCH_TYPE_COLORS[masterSwitch.type as keyof typeof SWITCH_TYPE_COLORS] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {masterSwitch.type.replace('_', ' ')}
              </span>
            )}
            {masterSwitch.technology && (
              <span 
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  SWITCH_TECHNOLOGY_COLORS[masterSwitch.technology as keyof typeof SWITCH_TECHNOLOGY_COLORS] || 'bg-gray-100 text-gray-800'
                }`}
              >
                {masterSwitch.technology.replace('_', ' ')}
              </span>
            )}
            {masterSwitch.clickType && (
              <span 
                className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
              >
                {masterSwitch.clickType}
              </span>
            )}
          </div>

          {/* Force Curves Button */}
          <div className="mb-6">
            <ForceCurvesButton
              switchName={`${masterSwitch.manufacturer} ${masterSwitch.name}`}
              manufacturer={masterSwitch.manufacturer}
            />
          </div>

          {/* Specifications Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Materials Section */}
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">Materials</h3>
              {masterSwitch.topHousing && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Top Housing:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{masterSwitch.topHousing}</span>
                </div>
              )}
              {masterSwitch.bottomHousing && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Bottom Housing:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{masterSwitch.bottomHousing}</span>
                </div>
              )}
              {masterSwitch.stem && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Stem:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{masterSwitch.stem}</span>
                </div>
              )}
            </div>

            {/* Spring & Force Section */}
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">Spring & Force</h3>
              {masterSwitch.springWeight && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Spring Weight:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{masterSwitch.springWeight}</span>
                </div>
              )}
              {masterSwitch.springLength && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Spring Length:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{masterSwitch.springLength}</span>
                </div>
              )}
              {masterSwitch.progressiveSpring && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Progressive Spring:</span>{' '}
                  <span className="text-gray-900 dark:text-white">Yes</span>
                </div>
              )}
              {masterSwitch.actuationForce && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Actuation Force:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{masterSwitch.actuationForce}g</span>
                </div>
              )}
              {masterSwitch.bottomOutForce && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Bottom Out Force:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{masterSwitch.bottomOutForce}g</span>
                </div>
              )}
              {masterSwitch.tactileForce && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Tactile Force:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{masterSwitch.tactileForce}g</span>
                </div>
              )}
            </div>

            {/* Travel Section */}
            <div className="space-y-2">
              <h3 className="font-semibold text-gray-900 dark:text-white">Travel</h3>
              {masterSwitch.preTravel && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Pre-travel:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{masterSwitch.preTravel}mm</span>
                </div>
              )}
              {masterSwitch.bottomOut && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Total Travel:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{masterSwitch.bottomOut}mm</span>
                </div>
              )}
              {masterSwitch.tactilePosition && (
                <div className="text-sm">
                  <span className="text-gray-500 dark:text-gray-400">Tactile Position:</span>{' '}
                  <span className="text-gray-900 dark:text-white">{masterSwitch.tactilePosition}mm</span>
                </div>
              )}
            </div>

            {/* Magnetic Properties Section (if applicable) */}
            {masterSwitch.technology === 'MAGNETIC' && (
              <div className="space-y-2">
                <h3 className="font-semibold text-gray-900 dark:text-white">Magnetic Properties</h3>
                {masterSwitch.magnetOrientation && (
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Orientation:</span>{' '}
                    <span className="text-gray-900 dark:text-white">{masterSwitch.magnetOrientation}</span>
                  </div>
                )}
                {masterSwitch.magnetPosition && (
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Position:</span>{' '}
                    <span className="text-gray-900 dark:text-white">{masterSwitch.magnetPosition}</span>
                  </div>
                )}
                {masterSwitch.magnetPolarity && (
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Polarity:</span>{' '}
                    <span className="text-gray-900 dark:text-white">{masterSwitch.magnetPolarity}</span>
                  </div>
                )}
                {masterSwitch.initialMagneticFlux && (
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Initial Flux:</span>{' '}
                    <span className="text-gray-900 dark:text-white">{masterSwitch.initialMagneticFlux}mT</span>
                  </div>
                )}
                {masterSwitch.bottomOutMagneticFlux && (
                  <div className="text-sm">
                    <span className="text-gray-500 dark:text-gray-400">Bottom Out Flux:</span>{' '}
                    <span className="text-gray-900 dark:text-white">{masterSwitch.bottomOutMagneticFlux}mT</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notes */}
          {masterSwitch.notes && (
            <div className="mt-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Notes</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{masterSwitch.notes}</p>
            </div>
          )}

          {/* Call to Action */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Want to add this switch to your collection?
              </p>
              <div className="flex items-center justify-center gap-4">
                <Link
                  href="/auth/register"
                  className="px-6 py-2 bg-blue-600 text-white font-medium rounded-md hover:bg-blue-700"
                >
                  Create Account
                </Link>
                <span className="text-gray-500 dark:text-gray-400">or</span>
                <Link
                  href="/auth/login"
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Sign in to existing account
                </Link>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                Join thousands of keyboard enthusiasts tracking their switch collections
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}