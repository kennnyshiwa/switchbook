'use client'

import { useState } from 'react'
import { Switch } from '@prisma/client'

interface SwitchTableProps {
  switches: Switch[]
  onDelete: (switchId: string) => void
  onEdit: (switchData: Switch) => void
}

export default function SwitchTable({ switches, onDelete, onEdit }: SwitchTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (switchItem: Switch) => {
    if (!confirm('Are you sure you want to delete this switch?')) return

    setDeletingId(switchItem.id)
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
      setDeletingId(null)
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
    <div className="bg-white shadow overflow-hidden sm:rounded-md">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Switch
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Manufacturer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Spring Weight
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Travel
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Materials
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {switches.map((switchItem) => (
              <tr key={switchItem.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">{switchItem.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${typeColors[switchItem.type]}`}>
                    {switchItem.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {switchItem.manufacturer}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {switchItem.springWeight || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {switchItem.travel || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  <div className="space-y-1">
                    {switchItem.topHousing && (
                      <div><span className="font-medium">Top:</span> {switchItem.topHousing}</div>
                    )}
                    {switchItem.bottomHousing && (
                      <div><span className="font-medium">Bottom:</span> {switchItem.bottomHousing}</div>
                    )}
                    {switchItem.stem && (
                      <div><span className="font-medium">Stem:</span> {switchItem.stem}</div>
                    )}
                    {!switchItem.topHousing && !switchItem.bottomHousing && !switchItem.stem && '-'}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                  {switchItem.notes || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
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
                      onClick={() => handleDelete(switchItem)}
                      disabled={deletingId === switchItem.id}
                      className="text-red-600 hover:text-red-800 disabled:opacity-50"
                      title="Delete switch"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}