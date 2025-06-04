'use client'

import { useState, memo } from 'react'
import { Switch } from '@prisma/client'
import { SWITCH_TYPE_COLORS } from '@/constants/switchTypes'
import { deleteSwitch } from '@/utils/switchActions'

interface SwitchTableProps {
  switches: Switch[]
  onDelete: (switchId: string) => void
  onEdit: (switchData: Switch) => void
}

function SwitchTable({ switches, onDelete, onEdit }: SwitchTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (switchItem: Switch) => {
    if (!confirm('Are you sure you want to delete this switch?')) return

    setDeletingId(switchItem.id)
    const success = await deleteSwitch(switchItem.id)
    if (success) {
      onDelete(switchItem.id)
    }
    setDeletingId(null)
  }


  return (
    <div className="bg-white dark:bg-gray-800 shadow overflow-hidden sm:rounded-md">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Switch
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Type
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Manufacturer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actuation Force
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Bottom Out Force
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Pre Travel
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Bottom Out
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Spring Weight
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Materials
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Notes
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
            {switches.map((switchItem) => (
              <tr key={switchItem.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">{switchItem.name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SWITCH_TYPE_COLORS[switchItem.type as keyof typeof SWITCH_TYPE_COLORS]}`}>
                    {switchItem.type.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.manufacturer || 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.actuationForce ? `${switchItem.actuationForce}g` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.bottomOutForce ? `${switchItem.bottomOutForce}g` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.preTravel ? `${switchItem.preTravel}mm` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.bottomOut ? `${switchItem.bottomOut}mm` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.springWeight || '-'}
                </td>
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
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
                <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
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

export default memo(SwitchTable)