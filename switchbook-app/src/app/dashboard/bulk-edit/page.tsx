'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@prisma/client'
import Link from 'next/link'
import ManufacturerAutocomplete from '@/components/ManufacturerAutocomplete'

interface EditableSwitchData {
  id: string
  name: string
  chineseName?: string
  type?: string
  technology?: string
  magnetOrientation?: string
  magnetPosition?: string
  magnetStrength?: number
  compatibility?: string
  manufacturer?: string
  springWeight?: string
  springLength?: string
  actuationForce?: number
  bottomOutForce?: number
  preTravel?: number
  bottomOut?: number
  notes?: string
  imageUrl?: string
  topHousing?: string
  bottomHousing?: string
  stem?: string
  dateObtained?: string
  selected?: boolean
}

type BulkEditStep = 'selection' | 'editing' | 'saving' | 'complete'

export default function BulkEditPage() {
  const [currentStep, setCurrentStep] = useState<BulkEditStep>('selection')
  const [switches, setSwitches] = useState<EditableSwitchData[]>([])
  const [selectedSwitches, setSelectedSwitches] = useState<EditableSwitchData[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [saveProgress, setSaveProgress] = useState(0)
  const [saveResults, setSaveResults] = useState<{ success: number; errors: string[] }>({ success: 0, errors: [] })

  // Fetch user's switches on component mount
  useEffect(() => {
    const fetchSwitches = async () => {
      try {
        const response = await fetch('/api/switches')
        if (response.ok) {
          const switchData = await response.json()
          const editableSwitches = switchData.map((sw: Switch) => ({
            ...sw,
            chineseName: sw.chineseName || '',
            type: sw.type || '',
            technology: sw.technology || '',
            magnetOrientation: sw.magnetOrientation || '',
            magnetPosition: sw.magnetPosition || '',
            magnetStrength: sw.magnetStrength || undefined,
            compatibility: sw.compatibility || '',
            manufacturer: sw.manufacturer || '',
            springWeight: sw.springWeight || '',
            springLength: sw.springLength || '',
            actuationForce: sw.actuationForce || undefined,
            bottomOutForce: sw.bottomOutForce || undefined,
            preTravel: sw.preTravel || undefined,
            bottomOut: sw.bottomOut || undefined,
            notes: sw.notes || '',
            imageUrl: sw.imageUrl || '',
            topHousing: sw.topHousing || '',
            bottomHousing: sw.bottomHousing || '',
            stem: sw.stem || '',
            dateObtained: sw.dateObtained ? new Date(sw.dateObtained).toISOString().split('T')[0] : '',
            selected: false
          }))
          setSwitches(editableSwitches)
        }
      } catch (error) {
        console.error('Failed to fetch switches:', error)
      }
    }
    fetchSwitches()
  }, [])

  const filteredSwitches = switches.filter(sw => 
    sw.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (sw.chineseName && sw.chineseName.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (sw.manufacturer && sw.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const toggleSwitchSelection = (switchId: string) => {
    setSwitches(prev => prev.map(sw => 
      sw.id === switchId ? { ...sw, selected: !sw.selected } : sw
    ))
  }

  const selectAllFiltered = () => {
    const allFilteredSelected = filteredSwitches.every(sw => sw.selected)
    setSwitches(prev => prev.map(sw => {
      if (filteredSwitches.find(filtered => filtered.id === sw.id)) {
        return { ...sw, selected: !allFilteredSelected }
      }
      return sw
    }))
  }

  const proceedToEdit = () => {
    const selected = switches.filter(sw => sw.selected)
    setSelectedSwitches(selected)
    setCurrentStep('editing')
  }

  const updateSelectedSwitch = (index: number, field: keyof EditableSwitchData, value: string | number | undefined) => {
    setSelectedSwitches(prev => prev.map((sw, i) => 
      i === index ? { ...sw, [field]: value } : sw
    ))
  }

  const bulkUpdateField = (field: keyof EditableSwitchData, value: string | number | undefined) => {
    setSelectedSwitches(prev => prev.map(sw => ({ ...sw, [field]: value })))
  }

  const saveSwitches = async () => {
    setCurrentStep('saving')
    setSaveProgress(0)
    
    const results = { success: 0, errors: [] as string[] }
    
    for (let i = 0; i < selectedSwitches.length; i++) {
      const switchItem = selectedSwitches[i]
      
      try {
        const { id, selected, ...switchData } = switchItem
        const response = await fetch(`/api/switches/${id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(switchData)
        })
        
        if (response.ok) {
          results.success++
        } else {
          const error = await response.text()
          results.errors.push(`${switchItem.name}: ${error}`)
        }
      } catch (error) {
        results.errors.push(`${switchItem.name}: Network error`)
      }
      
      setSaveProgress(Math.round(((i + 1) / selectedSwitches.length) * 100))
    }
    
    setSaveResults(results)
    setCurrentStep('complete')
  }

  if (currentStep === 'selection') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto p-6">
          <div className="mb-6">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center mb-4">
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Edit Switches</h1>
            <p className="text-gray-600 dark:text-gray-300">Select switches to edit in bulk</p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Your Switches ({switches.length})
              </h2>
              <div className="flex space-x-3">
                <input
                  type="text"
                  placeholder="Search switches..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md dark:bg-gray-700 dark:text-white"
                />
                <button
                  onClick={selectAllFiltered}
                  className="px-4 py-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
                >
                  {filteredSwitches.every(sw => sw.selected) ? 'Deselect All' : 'Select All'}
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              <div className="space-y-2">
                {filteredSwitches.map((switchItem) => (
                  <div
                    key={switchItem.id}
                    className={`flex items-center p-3 border rounded-lg cursor-pointer ${
                      switchItem.selected 
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                        : 'border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }`}
                    onClick={() => toggleSwitchSelection(switchItem.id)}
                  >
                    <input
                      type="checkbox"
                      checked={switchItem.selected || false}
                      onChange={() => toggleSwitchSelection(switchItem.id)}
                      className="mr-3 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">{switchItem.name}</div>
                      {switchItem.chineseName && (
                        <div className="text-sm text-gray-600 dark:text-gray-300">{switchItem.chineseName}</div>
                      )}
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {switchItem.manufacturer || 'Unknown'} • {switchItem.type || 'No type'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-600">
              <div className="text-sm text-gray-600 dark:text-gray-300">
                {switches.filter(sw => sw.selected).length} switches selected
              </div>
              <button
                onClick={proceedToEdit}
                disabled={switches.filter(sw => sw.selected).length === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Edit Selected ({switches.filter(sw => sw.selected).length})
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentStep === 'editing') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Bulk Edit {selectedSwitches.length} Switches
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Edit fields individually or apply changes to all selected switches
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Bulk Actions</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Set Type for All
                </label>
                <select
                  onChange={(e) => bulkUpdateField('type', e.target.value || undefined)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select type...</option>
                  <option value="LINEAR">Linear</option>
                  <option value="TACTILE">Tactile</option>
                  <option value="CLICKY">Clicky</option>
                  <option value="SILENT_LINEAR">Silent Linear</option>
                  <option value="SILENT_TACTILE">Silent Tactile</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Set Technology for All
                </label>
                <select
                  onChange={(e) => bulkUpdateField('technology', e.target.value || undefined)}
                  className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                >
                  <option value="">Select technology...</option>
                  <option value="MECHANICAL">Mechanical</option>
                  <option value="OPTICAL">Optical</option>
                  <option value="MAGNETIC">Magnetic</option>
                  <option value="INDUCTIVE">Inductive</option>
                  <option value="ELECTRO_CAPACITIVE">Electro Capacitive</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Set Manufacturer for All
                </label>
                <ManufacturerAutocomplete
                  value=""
                  onChange={(value) => bulkUpdateField('manufacturer', value)}
                  placeholder="Set manufacturer..."
                />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="max-h-96 overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Switch Name
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Technology
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Manufacturer
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actuation Force (g)
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {selectedSwitches.map((switchItem, index) => (
                    <tr key={switchItem.id}>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {switchItem.name}
                        </div>
                        {switchItem.chineseName && (
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {switchItem.chineseName}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <select
                          value={switchItem.type || ''}
                          onChange={(e) => updateSelectedSwitch(index, 'type', e.target.value || undefined)}
                          className="block w-full text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option value="">No type</option>
                          <option value="LINEAR">Linear</option>
                          <option value="TACTILE">Tactile</option>
                          <option value="CLICKY">Clicky</option>
                          <option value="SILENT_LINEAR">Silent Linear</option>
                          <option value="SILENT_TACTILE">Silent Tactile</option>
                        </select>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <select
                          value={switchItem.technology || ''}
                          onChange={(e) => updateSelectedSwitch(index, 'technology', e.target.value || undefined)}
                          className="block w-full text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        >
                          <option value="">No technology</option>
                          <option value="MECHANICAL">Mechanical</option>
                          <option value="OPTICAL">Optical</option>
                          <option value="MAGNETIC">Magnetic</option>
                          <option value="INDUCTIVE">Inductive</option>
                          <option value="ELECTRO_CAPACITIVE">Electro Capacitive</option>
                        </select>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <ManufacturerAutocomplete
                          value={switchItem.manufacturer || ''}
                          onChange={(value) => updateSelectedSwitch(index, 'manufacturer', value)}
                          placeholder="Manufacturer..."
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={switchItem.actuationForce || ''}
                          onChange={(e) => updateSelectedSwitch(index, 'actuationForce', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="block w-full text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                          placeholder="Force..."
                          min="0"
                          max="1000"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <button
                          onClick={() => setSelectedSwitches(prev => prev.filter((_, i) => i !== index))}
                          className="text-red-600 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 flex justify-between">
              <button
                onClick={() => setCurrentStep('selection')}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                ← Back to Selection
              </button>
              <button
                onClick={saveSwitches}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Save Changes ({selectedSwitches.length} switches)
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (currentStep === 'saving') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Saving Changes...</h1>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-4">
              <div 
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${saveProgress}%` }}
              ></div>
            </div>
            <p className="text-gray-600 dark:text-gray-300">{saveProgress}% complete</p>
          </div>
        </div>
      </div>
    )
  }

  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Bulk Edit Complete!</h1>
            
            <div className="space-y-4">
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md">
                <h3 className="font-medium text-green-900 dark:text-green-100">
                  Successfully updated {saveResults.success} switches
                </h3>
              </div>
              
              {saveResults.errors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md">
                  <h3 className="font-medium text-red-900 dark:text-red-100 mb-2">
                    {saveResults.errors.length} errors occurred:
                  </h3>
                  <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                    {saveResults.errors.map((error, index) => (
                      <li key={index}>• {error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <div className="mt-6 flex space-x-4">
              <Link
                href="/dashboard"
                className="flex-1 text-center px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                View Your Collection
              </Link>
              <button
                onClick={() => {
                  setCurrentStep('selection')
                  setSelectedSwitches([])
                  setSaveProgress(0)
                  setSaveResults({ success: 0, errors: [] })
                }}
                className="flex-1 px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Edit More
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return null
}