'use client'

import { useState } from 'react'
import Link from 'next/link'

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

interface WishlistDetailsPopupProps {
  item: WishlistItem
  onClose: () => void
  onMoveToCollection: (id: string) => void
  onDelete: (id: string) => void
  isMoving: boolean
  isDeleting: boolean
}

export default function WishlistDetailsPopup({
  item,
  onClose,
  onMoveToCollection,
  onDelete,
  isMoving,
  isDeleting
}: WishlistDetailsPopupProps) {
  const isCustom = !item.masterSwitch
  const name = item.customName || item.masterSwitch?.name || 'Unnamed Switch'
  const manufacturer = item.customManufacturer || item.masterSwitch?.manufacturer
  const imageUrl = item.masterSwitch?.imageUrl || item.masterSwitch?.images?.[0]?.url
  const notes = item.customNotes || item.masterSwitch?.notes

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="relative">
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4 flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{name}</h2>
              {item.masterSwitch?.chineseName && (
                <p className="text-lg text-gray-600 dark:text-gray-400">{item.masterSwitch.chineseName}</p>
              )}
              {manufacturer && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{manufacturer}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="overflow-y-auto max-h-[calc(90vh-8rem)]">
            {/* Image */}
            {imageUrl && (
              <div className="relative h-64 bg-gray-100 dark:bg-gray-900">
                <img
                  src={imageUrl}
                  alt={name}
                  className="w-full h-full object-contain"
                />
              </div>
            )}

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Custom Item Notice */}
              {isCustom && (
                <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
                  <p className="text-sm text-purple-800 dark:text-purple-200">
                    This is a custom wishlist item without master switch data.
                  </p>
                </div>
              )}

              {/* Switch Details */}
              {item.masterSwitch && (
                <>
                  {/* Basic Info */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Basic Information</h3>
                    <dl className="grid grid-cols-2 gap-4">
                      {item.masterSwitch.type && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Type</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">{item.masterSwitch.type.replace('_', ' ')}</dd>
                        </div>
                      )}
                      {item.masterSwitch.technology && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Technology</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">{item.masterSwitch.technology.replace('_', ' ')}</dd>
                        </div>
                      )}
                      {item.masterSwitch.compatibility && (
                        <div>
                          <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Compatibility</dt>
                          <dd className="text-sm text-gray-900 dark:text-white">{item.masterSwitch.compatibility}</dd>
                        </div>
                      )}
                    </dl>
                  </div>

                  {/* Force Specs */}
                  {(item.masterSwitch.actuationForce || item.masterSwitch.bottomOutForce) && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Force Specifications</h3>
                      <dl className="grid grid-cols-2 gap-4">
                        {item.masterSwitch.initialForce && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Initial Force</dt>
                            <dd className="text-sm text-gray-900 dark:text-white">{item.masterSwitch.initialForce}g</dd>
                          </div>
                        )}
                        {item.masterSwitch.actuationForce && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Actuation Force</dt>
                            <dd className="text-sm text-gray-900 dark:text-white">{item.masterSwitch.actuationForce}g</dd>
                          </div>
                        )}
                        {item.masterSwitch.tactileForce && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Tactile Force</dt>
                            <dd className="text-sm text-gray-900 dark:text-white">{item.masterSwitch.tactileForce}g</dd>
                          </div>
                        )}
                        {item.masterSwitch.bottomOutForce && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Bottom Out Force</dt>
                            <dd className="text-sm text-gray-900 dark:text-white">{item.masterSwitch.bottomOutForce}g</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}

                  {/* Travel */}
                  {(item.masterSwitch.preTravel || item.masterSwitch.bottomOut) && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Travel Distances</h3>
                      <dl className="grid grid-cols-2 gap-4">
                        {item.masterSwitch.preTravel && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Pre-travel</dt>
                            <dd className="text-sm text-gray-900 dark:text-white">{item.masterSwitch.preTravel}mm</dd>
                          </div>
                        )}
                        {item.masterSwitch.bottomOut && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Travel</dt>
                            <dd className="text-sm text-gray-900 dark:text-white">{item.masterSwitch.bottomOut}mm</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}

                  {/* Materials */}
                  {(item.masterSwitch.topHousing || item.masterSwitch.bottomHousing || item.masterSwitch.stem) && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Materials</h3>
                      <dl className="grid grid-cols-2 gap-4">
                        {item.masterSwitch.topHousing && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Top Housing</dt>
                            <dd className="text-sm text-gray-900 dark:text-white">{item.masterSwitch.topHousing}</dd>
                          </div>
                        )}
                        {item.masterSwitch.bottomHousing && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Bottom Housing</dt>
                            <dd className="text-sm text-gray-900 dark:text-white">{item.masterSwitch.bottomHousing}</dd>
                          </div>
                        )}
                        {item.masterSwitch.stem && (
                          <div>
                            <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Stem</dt>
                            <dd className="text-sm text-gray-900 dark:text-white">{item.masterSwitch.stem}</dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}
                </>
              )}

              {/* Notes */}
              {notes && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Notes</h3>
                  <p className="text-sm text-gray-900 dark:text-white whitespace-pre-wrap">{notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="sticky bottom-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4 flex justify-between">
            <div className="flex space-x-3">
              {item.masterSwitch && (
                <Link
                  href={`/switches/${item.masterSwitch.id}`}
                  className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-md"
                >
                  View Full Details
                </Link>
              )}
              <button
                onClick={() => onMoveToCollection(item.id)}
                disabled={isMoving}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
              >
                {isMoving ? 'Moving...' : 'Add to Collection'}
              </button>
            </div>
            <button
              onClick={() => onDelete(item.id)}
              disabled={isDeleting}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
            >
              {isDeleting ? 'Removing...' : 'Remove from Wishlist'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}