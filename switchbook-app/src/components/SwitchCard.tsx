'use client'

import { useState } from 'react'
import { Switch } from '@prisma/client'
import Image from 'next/image'

interface SwitchCardProps {
  switch: Switch
  onDelete: (switchId: string) => void
  onEdit: (switchData: Switch) => void
}

export default function SwitchCard({ switch: switchItem, onDelete, onEdit }: SwitchCardProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this switch?')) return

    setIsDeleting(true)
    try {
      const response = await fetch(`/api/switches/${switchItem.id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        onDelete(switchItem.id)
      }
    } catch (error) {
      console.error('Failed to delete switch:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  const typeColors = {
    LINEAR: 'bg-red-100 text-red-800',
    TACTILE: 'bg-brown-100 text-brown-800',
    CLICKY: 'bg-blue-100 text-blue-800',
    SILENT_LINEAR: 'bg-gray-100 text-gray-800',
    SILENT_TACTILE: 'bg-purple-100 text-purple-800',
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
      {switchItem.imageUrl && (
        <div className="relative h-48 bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
          <Image
            src={switchItem.imageUrl}
            alt={switchItem.name}
            fill
            className="object-contain"
          />
        </div>
      )}
      
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
          <div className="flex items-center space-x-2">
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColors[switchItem.type]}`}>
              {switchItem.type.replace('_', ' ')}
            </span>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-300">
            <span className="font-medium">Manufacturer:</span> {switchItem.manufacturer}
          </p>

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