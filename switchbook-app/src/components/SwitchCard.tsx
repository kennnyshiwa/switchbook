'use client'

import { useState, memo } from 'react'
import { Switch } from '@prisma/client'
import Image from 'next/image'
import { SWITCH_TYPE_COLORS } from '@/constants/switchTypes'
import { deleteSwitch } from '@/utils/switchActions'

interface SwitchCardProps {
  switch: Switch
  onDelete: (switchId: string) => void
  onEdit: (switchData: Switch) => void
}

function SwitchCard({ switch: switchItem, onDelete, onEdit }: SwitchCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this switch?')) return

    setIsDeleting(true)
    const success = await deleteSwitch(switchItem.id)
    if (success) {
      onDelete(switchItem.id)
    }
    setIsDeleting(false)
  }


  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      <div className="relative h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
        {switchItem.imageUrl ? (
          <Image
            src={switchItem.imageUrl}
            alt={switchItem.name}
            fill
            className="object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center text-gray-400 dark:text-gray-500">
            <svg className="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">No Image</span>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <div className="flex justify-between items-start mb-2">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{switchItem.name}</h3>
          <div className="flex space-x-2">
            <button
              onClick={() => onEdit(switchItem)}
              className="text-blue-600 hover:text-blue-800"
              title="Edit switch"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="text-red-600 hover:text-red-800 disabled:opacity-50"
              title="Delete switch"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SWITCH_TYPE_COLORS[switchItem.type as keyof typeof SWITCH_TYPE_COLORS]}`}>
              {switchItem.type.replace('_', ' ')}
            </span>
            {switchItem.dateObtained && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {(() => {
                  const date = new Date(switchItem.dateObtained)
                  // Add timezone offset to get the correct local date
                  const utcDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000)
                  return utcDate.toLocaleDateString()
                })()}
              </span>
            )}
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">Manufacturer:</span> {switchItem.manufacturer}
          </p>

          {(switchItem.actuationForce || switchItem.bottomOutForce || switchItem.preTravel || switchItem.bottomOut) && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Specs</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {switchItem.actuationForce && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Actuation:</span> {switchItem.actuationForce}g
                  </p>
                )}
                {switchItem.bottomOutForce && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Bottom Out:</span> {switchItem.bottomOutForce}g
                  </p>
                )}
                {switchItem.preTravel && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Pre Travel:</span> {switchItem.preTravel}mm
                  </p>
                )}
                {switchItem.bottomOut && (
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium">Bottom Out:</span> {switchItem.bottomOut}mm
                  </p>
                )}
              </div>
            </div>
          )}

          {switchItem.springWeight && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium">Spring:</span> {switchItem.springWeight}
            </p>
          )}

          {switchItem.travel && (
            <p className="text-sm text-gray-600 dark:text-gray-300">
              <span className="font-medium">Travel:</span> {switchItem.travel}
            </p>
          )}

          {(switchItem.topHousing || switchItem.bottomHousing || switchItem.stem) && (
            <div className="border-t border-gray-200 dark:border-gray-600 pt-2 mt-2">
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Materials</p>
              {switchItem.topHousing && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium">Top:</span> {switchItem.topHousing}
                </p>
              )}
              {switchItem.bottomHousing && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium">Bottom:</span> {switchItem.bottomHousing}
                </p>
              )}
              {switchItem.stem && (
                <p className="text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium">Stem:</span> {switchItem.stem}
                </p>
              )}
            </div>
          )}

          {switchItem.notes && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{switchItem.notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(SwitchCard)