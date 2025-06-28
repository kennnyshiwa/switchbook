'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { SwitchType, SwitchTechnology } from '@prisma/client'
import { linkify } from '@/utils/linkify'

interface MasterSwitch {
  id: string
  name: string
  chineseName?: string
  type?: SwitchType
  technology?: SwitchTechnology
  manufacturer?: string
  actuationForce?: number
  tactileForce?: number
  bottomOutForce?: number
  progressiveSpring?: boolean
  doubleStage?: boolean
  preTravel?: number
  bottomOut?: number
  springWeight?: string
  springLength?: string
  notes?: string
  imageUrl?: string
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
  clickType?: 'CLICK_LEAF' | 'CLICK_BAR' | 'CLICK_JACKET'
  inCollection: boolean
  userCount: number
  submittedBy: {
    id: string
    username: string
  }
}

interface MasterSwitchDetailsPopupProps {
  switchItem: MasterSwitch
  onClose: () => void
  onAddToCollection: (switchId: string) => void
  onDeleteSwitch?: (switchId: string) => void
  onOpenLinkDialog: (switchItem: { id: string; name: string }) => void
  isAddingSwitch: boolean
  isDeletingSwitch: boolean
  isAdmin?: boolean
}

export default function MasterSwitchDetailsPopup({
  switchItem,
  onClose,
  onAddToCollection,
  onDeleteSwitch,
  onOpenLinkDialog,
  isAddingSwitch,
  isDeletingSwitch,
  isAdmin
}: MasterSwitchDetailsPopupProps) {
  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [onClose])

  // Prevent body scroll when popup is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [])

  return (
    <div 
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-lg max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {switchItem.name}
              {switchItem.chineseName && (
                <span className="text-lg text-gray-500 dark:text-gray-400 ml-2">
                  {switchItem.chineseName}
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              Submitted by {switchItem.submittedBy.username} · Used by {switchItem.userCount} {switchItem.userCount === 1 ? 'person' : 'people'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Image */}
            {switchItem.imageUrl && (
              <div className="md:col-span-2">
                <img
                  src={switchItem.imageUrl}
                  alt={switchItem.name}
                  className="w-full h-64 object-contain bg-gray-100 dark:bg-gray-900 rounded-lg"
                />
              </div>
            )}

            {/* Basic Info */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Basic Information</h3>
              <div className="space-y-2 text-sm">
                {switchItem.manufacturer && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Manufacturer</span>
                    <span className="text-gray-900 dark:text-white">{switchItem.manufacturer}</span>
                  </div>
                )}
                {switchItem.type && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Type</span>
                    <span className="text-gray-900 dark:text-white">{switchItem.type.replace('_', ' ')}</span>
                  </div>
                )}
                {switchItem.technology && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Technology</span>
                    <span className="text-gray-900 dark:text-white">{switchItem.technology}</span>
                  </div>
                )}
                {switchItem.compatibility && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Compatibility</span>
                    <span className="text-gray-900 dark:text-white">{switchItem.compatibility}</span>
                  </div>
                )}
                {switchItem.clickType && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Click Type</span>
                    <span className="text-gray-900 dark:text-white">{switchItem.clickType.replace(/_/g, ' ')}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Force Specifications */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Force Specifications</h3>
              <div className="space-y-2 text-sm">
                {switchItem.initialForce && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Initial Force</span>
                    <span className="text-gray-900 dark:text-white">{switchItem.initialForce}g</span>
                  </div>
                )}
                {switchItem.actuationForce && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Actuation Force</span>
                    <span className="text-gray-900 dark:text-white">{switchItem.actuationForce}g</span>
                  </div>
                )}
                {switchItem.tactileForce && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Tactile Force</span>
                    <span className="text-gray-900 dark:text-white">{switchItem.tactileForce}g</span>
                  </div>
                )}
                {switchItem.bottomOutForce && (
                  <div className="flex justify-between">
                    <span className="font-medium text-gray-600 dark:text-gray-400">Bottom Out Force</span>
                    <span className="text-gray-900 dark:text-white">{switchItem.bottomOutForce}g</span>
                  </div>
                )}
              </div>
            </div>

            {/* Travel Distances */}
            {(switchItem.preTravel || switchItem.bottomOut) && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Travel Distances</h3>
                <div className="space-y-2 text-sm">
                  {switchItem.preTravel && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Pre-Travel</span>
                      <span className="text-gray-900 dark:text-white">{switchItem.preTravel}mm</span>
                    </div>
                  )}
                  {switchItem.bottomOut && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Total Travel</span>
                      <span className="text-gray-900 dark:text-white">{switchItem.bottomOut}mm</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Spring Properties */}
            {(switchItem.springWeight || switchItem.springLength || switchItem.progressiveSpring || switchItem.doubleStage) && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Spring Properties</h3>
                <div className="space-y-2 text-sm">
                  {switchItem.springWeight && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Spring Weight</span>
                      <span className="text-gray-900 dark:text-white">{switchItem.springWeight}</span>
                    </div>
                  )}
                  {switchItem.springLength && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Spring Length</span>
                      <span className="text-gray-900 dark:text-white">{switchItem.springLength}</span>
                    </div>
                  )}
                  {switchItem.progressiveSpring && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Progressive Spring</span>
                      <span className="text-gray-900 dark:text-white">Yes</span>
                    </div>
                  )}
                  {switchItem.doubleStage && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Double Stage</span>
                      <span className="text-gray-900 dark:text-white">Yes</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Materials */}
            {(switchItem.topHousing || switchItem.bottomHousing || switchItem.stem) && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Materials</h3>
                <div className="space-y-2 text-sm">
                  {switchItem.topHousing && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Top Housing</span>
                      <span className="text-gray-900 dark:text-white">{switchItem.topHousing}</span>
                    </div>
                  )}
                  {switchItem.bottomHousing && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Bottom Housing</span>
                      <span className="text-gray-900 dark:text-white">{switchItem.bottomHousing}</span>
                    </div>
                  )}
                  {switchItem.stem && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Stem</span>
                      <span className="text-gray-900 dark:text-white">{switchItem.stem}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Magnetic Properties */}
            {switchItem.technology === 'MAGNETIC' && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Magnetic Properties</h3>
                <div className="space-y-2 text-sm">
                  {switchItem.magnetOrientation && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Orientation</span>
                      <span className="text-gray-900 dark:text-white">{switchItem.magnetOrientation}</span>
                    </div>
                  )}
                  {switchItem.magnetPosition && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Position</span>
                      <span className="text-gray-900 dark:text-white">{switchItem.magnetPosition}</span>
                    </div>
                  )}
                  {switchItem.magnetPolarity && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Polarity</span>
                      <span className="text-gray-900 dark:text-white">{switchItem.magnetPolarity}</span>
                    </div>
                  )}
                  {switchItem.initialMagneticFlux && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Initial Flux</span>
                      <span className="text-gray-900 dark:text-white">{switchItem.initialMagneticFlux}Gs</span>
                    </div>
                  )}
                  {switchItem.bottomOutMagneticFlux && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">Bottom Out Flux</span>
                      <span className="text-gray-900 dark:text-white">{switchItem.bottomOutMagneticFlux}Gs</span>
                    </div>
                  )}
                  {switchItem.pcbThickness && (
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-600 dark:text-gray-400">PCB Thickness</span>
                      <span className="text-gray-900 dark:text-white">{switchItem.pcbThickness}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Notes */}
            {switchItem.notes && (
              <div className="md:col-span-2 space-y-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notes</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300">{linkify(switchItem.notes)}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            {switchItem.inCollection ? (
              <span className="text-green-600 dark:text-green-400 text-sm">
                ✓ In your collection
              </span>
            ) : (
              <button
                onClick={() => onAddToCollection(switchItem.id)}
                disabled={isAddingSwitch}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {isAddingSwitch ? 'Adding...' : 'Add to Collection'}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/switches/${switchItem.id}`}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              View Full Details
            </Link>
            
            {!switchItem.inCollection && (
              <button
                onClick={() => onOpenLinkDialog({ id: switchItem.id, name: switchItem.name })}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
              >
                Link to Collection
              </button>
            )}
            
            <Link
              href={`/switches/${switchItem.id}/suggest-edit`}
              className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              Suggest Edit
            </Link>

            {isAdmin && onDeleteSwitch && (
              <button
                onClick={() => onDeleteSwitch(switchItem.id)}
                disabled={isDeletingSwitch}
                className="px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 rounded-md disabled:opacity-50"
              >
                {isDeletingSwitch ? 'Deleting...' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}