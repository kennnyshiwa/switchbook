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
}

type BulkEditStep = 'loading' | 'editing' | 'saving' | 'complete'

export default function BulkEditPage() {
  const [currentStep, setCurrentStep] = useState<BulkEditStep>('loading')
  const [switches, setSwitches] = useState<EditableSwitchData[]>([])
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
            id: sw.id,
            name: sw.name,
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
            dateObtained: sw.dateObtained ? new Date(sw.dateObtained).toISOString().split('T')[0] : ''
          }))
          setSwitches(editableSwitches)
          setCurrentStep('editing')
        }
      } catch (error) {
        console.error('Failed to fetch switches:', error)
      }
    }
    fetchSwitches()
  }, [])

  const updateSwitch = (index: number, field: keyof EditableSwitchData, value: string | number | undefined) => {
    setSwitches(prev => prev.map((sw, i) => 
      i === index ? { ...sw, [field]: value } : sw
    ))
  }

  // Check if any switches have MAGNETIC technology to show/hide magnetic fields
  const showMagneticFields = switches.some(sw => sw.technology === 'MAGNETIC')

  const saveSwitches = async () => {
    setCurrentStep('saving')
    setSaveProgress(0)
    
    const results = { success: 0, errors: [] as string[] }
    
    for (let i = 0; i < switches.length; i++) {
      const switchItem = switches[i]
      
      try {
        const { id, ...switchData } = switchItem
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
      
      setSaveProgress(Math.round(((i + 1) / switches.length) * 100))
    }
    
    setSaveResults(results)
    setCurrentStep('complete')
  }

  if (currentStep === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto p-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Loading Your Switches...</h1>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      </div>
    )
  }

  if (currentStep === 'editing') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-full mx-auto p-6">
          <div className="mb-6">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center mb-4">
              ← Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Edit Switches</h1>
            <p className="text-gray-600 dark:text-gray-300">
              Edit your {switches.length} switches in bulk
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
            <div className="max-h-[70vh] overflow-x-auto overflow-y-auto">
              <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider min-w-[250px]">
                      Name*
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Chinese Name
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Technology
                    </th>
                    {showMagneticFields && (
                      <>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Magnetic Pole Orientation
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Magnet Position
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Magnet Strength (Gs)
                        </th>
                      </>
                    )}
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Compatibility
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Manufacturer
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Spring Weight
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Spring Length
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Actuation Force (g)
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Bottom Out Force (g)
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Pre-travel (mm)
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Bottom Out (mm)
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Top Housing
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Bottom Housing
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Stem
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Notes
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Image URL
                    </th>
                    <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date Obtained
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {switches.map((switchItem, index) => (
                    <tr key={switchItem.id}>
                      <td className="px-3 py-4">
                        <input
                          type="text"
                          value={switchItem.name}
                          onChange={(e) => updateSwitch(index, 'name', e.target.value)}
                          className="block w-full min-w-[250px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={switchItem.chineseName || ''}
                          onChange={(e) => updateSwitch(index, 'chineseName', e.target.value)}
                          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <select
                          value={switchItem.type || ''}
                          onChange={(e) => updateSwitch(index, 'type', e.target.value || undefined)}
                          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        >
                          <option value="">No type</option>
                          <option value="LINEAR">LINEAR</option>
                          <option value="TACTILE">TACTILE</option>
                          <option value="CLICKY">CLICKY</option>
                          <option value="SILENT_LINEAR">SILENT_LINEAR</option>
                          <option value="SILENT_TACTILE">SILENT_TACTILE</option>
                        </select>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <select
                          value={switchItem.technology || ''}
                          onChange={(e) => updateSwitch(index, 'technology', e.target.value || undefined)}
                          className="block w-full min-w-[180px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        >
                          <option value="">No technology</option>
                          <option value="MECHANICAL">MECHANICAL</option>
                          <option value="OPTICAL">OPTICAL</option>
                          <option value="MAGNETIC">MAGNETIC</option>
                          <option value="INDUCTIVE">INDUCTIVE</option>
                          <option value="ELECTRO_CAPACITIVE">ELECTRO_CAPACITIVE</option>
                        </select>
                      </td>
                      {showMagneticFields && (
                        <>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <select
                              value={switchItem.magnetOrientation || ''}
                              onChange={(e) => updateSwitch(index, 'magnetOrientation', e.target.value || undefined)}
                              className="block w-full min-w-[140px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                            >
                              <option value="">No orientation</option>
                              <option value="Horizontal">Horizontal</option>
                              <option value="Vertical">Vertical</option>
                            </select>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <select
                              value={switchItem.magnetPosition || ''}
                              onChange={(e) => updateSwitch(index, 'magnetPosition', e.target.value || undefined)}
                              className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                            >
                              <option value="">No position</option>
                              <option value="Center">Center</option>
                              <option value="Off-Center">Off-Center</option>
                            </select>
                          </td>
                          <td className="px-3 py-4 whitespace-nowrap">
                            <input
                              type="number"
                              value={switchItem.magnetStrength || ''}
                              onChange={(e) => updateSwitch(index, 'magnetStrength', e.target.value ? parseFloat(e.target.value) : undefined)}
                              className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                              placeholder="e.g. 35, 3500"
                              min="0"
                              max="10000"
                              step="0.1"
                            />
                          </td>
                        </>
                      )}
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={switchItem.compatibility || ''}
                          onChange={(e) => updateSwitch(index, 'compatibility', e.target.value)}
                          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                          placeholder="e.g. MX-style"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <div className="min-w-[100px]">
                          <ManufacturerAutocomplete
                            value={switchItem.manufacturer || ''}
                            onChange={(value) => updateSwitch(index, 'manufacturer', value)}
                            placeholder="Type manufacturer..."
                          />
                        </div>
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={switchItem.springWeight || ''}
                          onChange={(e) => updateSwitch(index, 'springWeight', e.target.value)}
                          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={switchItem.springLength || ''}
                          onChange={(e) => updateSwitch(index, 'springLength', e.target.value)}
                          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={switchItem.actuationForce || ''}
                          onChange={(e) => updateSwitch(index, 'actuationForce', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                          min="0"
                          max="1000"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={switchItem.bottomOutForce || ''}
                          onChange={(e) => updateSwitch(index, 'bottomOutForce', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                          min="0"
                          max="1000"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={switchItem.preTravel || ''}
                          onChange={(e) => updateSwitch(index, 'preTravel', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                          min="0"
                          max="10"
                          step="0.1"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="number"
                          value={switchItem.bottomOut || ''}
                          onChange={(e) => updateSwitch(index, 'bottomOut', e.target.value ? parseFloat(e.target.value) : undefined)}
                          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                          min="0"
                          max="10"
                          step="0.1"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={switchItem.topHousing || ''}
                          onChange={(e) => updateSwitch(index, 'topHousing', e.target.value)}
                          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={switchItem.bottomHousing || ''}
                          onChange={(e) => updateSwitch(index, 'bottomHousing', e.target.value)}
                          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="text"
                          value={switchItem.stem || ''}
                          onChange={(e) => updateSwitch(index, 'stem', e.target.value)}
                          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-4">
                        <textarea
                          value={switchItem.notes || ''}
                          onChange={(e) => updateSwitch(index, 'notes', e.target.value)}
                          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                          rows={2}
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="url"
                          value={switchItem.imageUrl || ''}
                          onChange={(e) => updateSwitch(index, 'imageUrl', e.target.value)}
                          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        />
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap">
                        <input
                          type="date"
                          value={switchItem.dateObtained || ''}
                          onChange={(e) => updateSwitch(index, 'dateObtained', e.target.value)}
                          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 flex justify-between">
              <Link
                href="/dashboard"
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              >
                ← Back to Dashboard
              </Link>
              <button
                onClick={saveSwitches}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Save All Changes ({switches.length} switches)
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
                  setCurrentStep('loading')
                  setSaveProgress(0)
                  setSaveResults({ success: 0, errors: [] })
                  // Reload switches
                  const fetchSwitches = async () => {
                    try {
                      const response = await fetch('/api/switches')
                      if (response.ok) {
                        const switchData = await response.json()
                        const editableSwitches = switchData.map((sw: Switch) => ({
                          id: sw.id,
                          name: sw.name,
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
                          dateObtained: sw.dateObtained ? new Date(sw.dateObtained).toISOString().split('T')[0] : ''
                        }))
                        setSwitches(editableSwitches)
                        setCurrentStep('editing')
                      }
                    } catch (error) {
                      console.error('Failed to fetch switches:', error)
                    }
                  }
                  fetchSwitches()
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