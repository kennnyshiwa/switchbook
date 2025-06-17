'use client'

import { useState, useEffect } from 'react'
import { UseFormSetValue } from 'react-hook-form'
import { z } from 'zod'
import { switchSchema } from '@/lib/validation'
import debounce from 'lodash/debounce'

type SwitchFormData = z.infer<typeof switchSchema>

interface MasterSwitch {
  id: string
  name: string
  chineseName?: string
  manufacturer?: string
  type?: string
  technology?: string
  actuationForce?: number
  bottomOutForce?: number
  preTravel?: number
  bottomOut?: number
  springWeight?: string
  springLength?: string
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
  notes?: string
  imageUrl?: string
}

interface MasterSwitchSuggestionsProps {
  searchQuery: string
  setValue: UseFormSetValue<SwitchFormData>
  onSelectSwitch: (switchData: MasterSwitch) => void
}

export default function MasterSwitchSuggestions({ searchQuery, setValue, onSelectSwitch }: MasterSwitchSuggestionsProps) {
  const [suggestions, setSuggestions] = useState<MasterSwitch[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)

  // Debounced search function
  const searchMasterSwitches = debounce(async (query: string) => {
    if (query.length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/master-switches/search?q=${encodeURIComponent(query)}`)
      if (response.ok) {
        const data = await response.json()
        setSuggestions(data.switches)
        setShowSuggestions(data.switches.length > 0)
      }
    } catch (error) {
      console.error('Failed to search master switches:', error)
    } finally {
      setIsLoading(false)
    }
  }, 300)

  useEffect(() => {
    searchMasterSwitches(searchQuery)
  }, [searchQuery])

  const handleSelectSwitch = (masterSwitch: MasterSwitch) => {
    // Map master switch data to form fields
    setValue('name', masterSwitch.name)
    if (masterSwitch.chineseName) setValue('chineseName', masterSwitch.chineseName)
    if (masterSwitch.manufacturer) setValue('manufacturer', masterSwitch.manufacturer)
    if (masterSwitch.type) setValue('type', masterSwitch.type as any)
    if (masterSwitch.technology) setValue('technology', masterSwitch.technology as any)
    if (masterSwitch.actuationForce) setValue('actuationForce', masterSwitch.actuationForce)
    if (masterSwitch.bottomOutForce) setValue('bottomOutForce', masterSwitch.bottomOutForce)
    if (masterSwitch.preTravel) setValue('preTravel', masterSwitch.preTravel)
    if (masterSwitch.bottomOut) setValue('bottomOut', masterSwitch.bottomOut)
    if (masterSwitch.springWeight) setValue('springWeight', masterSwitch.springWeight)
    if (masterSwitch.springLength) setValue('springLength', masterSwitch.springLength)
    if (masterSwitch.topHousing) setValue('topHousing', masterSwitch.topHousing)
    if (masterSwitch.bottomHousing) setValue('bottomHousing', masterSwitch.bottomHousing)
    if (masterSwitch.stem) setValue('stem', masterSwitch.stem)
    if (masterSwitch.notes) setValue('notes', masterSwitch.notes)
    if (masterSwitch.imageUrl) setValue('imageUrl', masterSwitch.imageUrl)
    
    // Magnetic switch properties
    if (masterSwitch.magnetOrientation) setValue('magnetOrientation', masterSwitch.magnetOrientation)
    if (masterSwitch.magnetPosition) setValue('magnetPosition', masterSwitch.magnetPosition)
    if (masterSwitch.magnetPolarity) setValue('magnetPolarity', masterSwitch.magnetPolarity)
    if (masterSwitch.initialForce) setValue('initialForce', masterSwitch.initialForce)
    if (masterSwitch.initialMagneticFlux) setValue('initialMagneticFlux', masterSwitch.initialMagneticFlux)
    if (masterSwitch.bottomOutMagneticFlux) setValue('bottomOutMagneticFlux', masterSwitch.bottomOutMagneticFlux)
    if (masterSwitch.pcbThickness) setValue('pcbThickness', masterSwitch.pcbThickness)
    if (masterSwitch.compatibility) setValue('compatibility', masterSwitch.compatibility)

    // Hide suggestions and call parent callback
    setShowSuggestions(false)
    onSelectSwitch(masterSwitch)
  }

  if (!showSuggestions) return null

  return (
    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
      {isLoading ? (
        <div className="p-4 text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto"></div>
        </div>
      ) : (
        <>
          <div className="p-2 bg-purple-50 dark:bg-purple-900/20 border-b border-gray-200 dark:border-gray-700">
            <p className="text-sm text-purple-700 dark:text-purple-300 font-medium">
              Master Database Matches
            </p>
          </div>
          <div className="py-1">
            {suggestions.map((masterSwitch) => (
              <button
                key={masterSwitch.id}
                type="button"
                onClick={() => handleSelectSwitch(masterSwitch)}
                className="w-full text-left px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-700 focus:bg-gray-100 dark:focus:bg-gray-700 focus:outline-none"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {masterSwitch.name}
                      {masterSwitch.chineseName && (
                        <span className="text-gray-500 dark:text-gray-400 ml-2">
                          {masterSwitch.chineseName}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {masterSwitch.manufacturer} • {masterSwitch.type?.replace('_', ' ')}
                    </div>
                  </div>
                  <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white text-xs font-bold rounded-full">
                    M
                  </span>
                </div>
              </button>
            ))}
          </div>
          <div className="p-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Select to auto-fill switch details from master database
            </p>
          </div>
        </>
      )}
    </div>
  )
}