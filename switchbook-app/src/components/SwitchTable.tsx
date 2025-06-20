'use client'

import { useState, memo } from 'react'
import { Switch } from '@prisma/client'
import { SWITCH_TYPE_COLORS, SWITCH_TECHNOLOGY_COLORS } from '@/constants/switchTypes'
import { deleteSwitch } from '@/utils/switchActions'
import ForceCurvesButton from './ForceCurvesButton'
import { formatWithUnit } from '@/utils/formatters'
import { linkify } from '@/utils/linkify'

interface SwitchImage {
  id: string
  url: string
  type: 'UPLOADED' | 'LINKED'
  order: number
  caption?: string | null
  thumbnailUrl?: string
  mediumUrl?: string
}

interface ExtendedSwitch extends Switch {
  images?: SwitchImage[]
}

interface SwitchTableProps {
  switches: ExtendedSwitch[]
  onDelete: (switchId: string) => void
  onEdit: (switchData: ExtendedSwitch) => void
  showForceCurves: boolean
  forceCurveCache?: Map<string, boolean>
  forceCurvePreferencesMap?: Map<string, { folder: string; url: string }>
}

function SwitchTable({ switches, onDelete, onEdit, showForceCurves, forceCurveCache, forceCurvePreferencesMap }: SwitchTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (switchItem: ExtendedSwitch) => {
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
                Technology
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Manufacturer
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Compatibility
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Initial Force
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
                Bottom Out/Total Travel
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Initial Flux
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Bottom Out Flux
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Magnet Orientation
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Magnet Position
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                PCB Thickness
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Magnet Polarity
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Spring Weight
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Spring Length
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Materials
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                Franken Parts
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
                  {!switchItem.name && switchItem.chineseName ? (
                    <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                      {switchItem.chineseName}
                      {switchItem.masterSwitchId && (
                        <span 
                          className="inline-flex items-center justify-center w-5 h-5 bg-purple-600 text-white text-xs font-bold rounded-full"
                          title="Linked to Master Database"
                        >
                          M
                        </span>
                      )}
                    </div>
                  ) : (
                    <div>
                      <div className="text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        {switchItem.name}
                        {switchItem.masterSwitchId && (
                          <span 
                            className="inline-flex items-center justify-center w-5 h-5 bg-purple-600 text-white text-xs font-bold rounded-full"
                            title="Linked to Master Database"
                          >
                            M
                          </span>
                        )}
                      </div>
                      {switchItem.chineseName && (
                        <div className="text-sm text-gray-600 dark:text-gray-300">{switchItem.chineseName}</div>
                      )}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {switchItem.type ? (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SWITCH_TYPE_COLORS[switchItem.type as keyof typeof SWITCH_TYPE_COLORS]}`}>
                      {switchItem.type.replace('_', ' ')}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                      No Type
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {switchItem.technology ? (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      switchItem.technology === 'MECHANICAL' ? 'bg-green-100 text-green-900 dark:bg-green-800 dark:text-green-200' :
                      switchItem.technology === 'OPTICAL' ? 'bg-yellow-100 text-yellow-900 dark:bg-yellow-800 dark:text-yellow-200' :
                      switchItem.technology === 'MAGNETIC' ? 'bg-pink-100 text-pink-900 dark:bg-pink-800 dark:text-pink-200' :
                      switchItem.technology === 'INDUCTIVE' ? 'bg-cyan-100 text-cyan-900 dark:bg-cyan-800 dark:text-cyan-200' :
                      switchItem.technology === 'ELECTRO_CAPACITIVE' ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-800 dark:text-indigo-200' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {switchItem.technology.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-500 dark:text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.manufacturer || 'Unknown'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.compatibility || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.initialForce ? `${switchItem.initialForce}g` : '-'}
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
                  {switchItem.initialMagneticFlux ? `${switchItem.initialMagneticFlux}Gs` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.bottomOutMagneticFlux ? `${switchItem.bottomOutMagneticFlux}Gs` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.magnetOrientation || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.magnetPosition || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.pcbThickness || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {switchItem.magnetPolarity || '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {formatWithUnit(switchItem.springWeight, 'g')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                  {formatWithUnit(switchItem.springLength, 'mm')}
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
                <td className="px-6 py-4 text-sm text-gray-900 dark:text-gray-300">
                  <div className="space-y-1">
                    {switchItem.frankenTop && (
                      <div><span className="font-medium">Top:</span> {switchItem.frankenTop}</div>
                    )}
                    {switchItem.frankenBottom && (
                      <div><span className="font-medium">Bottom:</span> {switchItem.frankenBottom}</div>
                    )}
                    {switchItem.frankenStem && (
                      <div><span className="font-medium">Stem:</span> {switchItem.frankenStem}</div>
                    )}
                    {!switchItem.frankenTop && !switchItem.frankenBottom && !switchItem.frankenStem && '-'}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm max-w-xs">
                  <div className="space-y-2">
                    {switchItem.notes && (
                      <div>
                        {switchItem.masterSwitchId && (
                          <span className="text-xs font-medium text-gray-600 dark:text-gray-400 block">Master Notes:</span>
                        )}
                        <span className="text-gray-500 dark:text-gray-400">{linkify(switchItem.notes)}</span>
                      </div>
                    )}
                    {switchItem.masterSwitchId && switchItem.personalNotes && (
                      <div>
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300 block">Personal Notes:</span>
                        <span className="text-blue-600 dark:text-blue-400">{linkify(switchItem.personalNotes)}</span>
                      </div>
                    )}
                    {!switchItem.notes && (!switchItem.masterSwitchId || !switchItem.personalNotes) && '-'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end items-center space-x-2">
                    {showForceCurves && (
                      <ForceCurvesButton 
                        switchName={switchItem.name}
                        manufacturer={switchItem.manufacturer}
                        variant="icon"
                        isAuthenticated={true}
                        forceCurvesCached={forceCurveCache?.get(`${switchItem.name}|${switchItem.manufacturer || ''}`) ?? false}
                        savedPreference={forceCurvePreferencesMap?.get(`${switchItem.name}|${switchItem.manufacturer || ''}`)}
                      />
                    )}
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