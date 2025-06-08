'use client'

import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Switch } from '@prisma/client'
import Link from 'next/link'
import { validateManufacturers, ManufacturerValidationResult } from '@/utils/manufacturerValidation'

interface EditableSwitchData {
  id: string
  name: string
  chineseName?: string
  type?: string
  technology?: string
  magnetOrientation?: string
  magnetPosition?: string
  magnetPolarity?: string
  initialForce?: number
  initialMagneticFlux?: number
  bottomOutMagneticFlux?: number
  pcbThickness?: string
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
  manufacturerValid?: boolean
  manufacturerSuggestions?: string[]
}

type BulkEditStep = 'loading' | 'editing' | 'saving' | 'complete'

// Shared manufacturer cache
let manufacturerCache: { id: string; name: string }[] = []
let manufacturerCachePromise: Promise<void> | null = null

const fetchManufacturers = async () => {
  if (manufacturerCache.length > 0) return manufacturerCache
  
  if (!manufacturerCachePromise) {
    manufacturerCachePromise = fetch('/api/manufacturers')
      .then(res => res.json())
      .then(data => {
        manufacturerCache = data || []
      })
      .catch(err => {
        console.error('Failed to fetch manufacturers:', err)
        manufacturerCache = []
      })
  }
  
  await manufacturerCachePromise
  return manufacturerCache
}

// Memoized table row component to prevent unnecessary re-renders
const SwitchEditRow = memo(({ 
  switchItem, 
  index, 
  onUpdate,
  onManufacturerSubmitted,
  submittedManufacturers,
  showMagneticFields,
  invalidRowRef
}: {
  switchItem: EditableSwitchData
  index: number
  onUpdate: (index: number, field: keyof EditableSwitchData, value: string | number | undefined) => void
  onManufacturerSubmitted: (name: string) => void
  submittedManufacturers: Set<string>
  showMagneticFields: boolean
  invalidRowRef?: (el: HTMLTableRowElement | null) => void
}) => {
  // Local state for each input to prevent re-renders of other rows
  const [localValues, setLocalValues] = useState(switchItem)
  const [manufacturerSuggestions, setManufacturerSuggestions] = useState<{ id: string; name: string }[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const manufacturerInputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  // Update local state when switchItem changes
  useEffect(() => {
    setLocalValues(switchItem)
  }, [switchItem])

  // Load manufacturers on component mount
  useEffect(() => {
    fetchManufacturers()
  }, [])

  // Ref to store timeout IDs for debouncing
  const timeoutRefs = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Handle manufacturer input changes with autocomplete
  const handleManufacturerChange = useCallback((value: string) => {
    setLocalValues(prev => ({ ...prev, manufacturer: value }))
    
    // Filter suggestions based on input
    if (value.length > 0) {
      const filtered = manufacturerCache.filter(m => 
        m.name.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5) // Limit to 5 suggestions
      setManufacturerSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
      setSelectedSuggestionIndex(-1)
    } else {
      setShowSuggestions(false)
      setManufacturerSuggestions([])
    }
    
    // Debounced update to parent
    const existingTimeout = timeoutRefs.current.get('manufacturer')
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }
    
    const timeoutId = setTimeout(() => {
      onUpdate(index, 'manufacturer', value)
      timeoutRefs.current.delete('manufacturer')
    }, 300)
    
    timeoutRefs.current.set('manufacturer', timeoutId)
  }, [index, onUpdate])

  // Handle suggestion selection
  const selectSuggestion = useCallback((manufacturerName: string) => {
    setLocalValues(prev => ({ ...prev, manufacturer: manufacturerName }))
    setShowSuggestions(false)
    setSelectedSuggestionIndex(-1)
    
    // Immediate update for suggestion selection
    onUpdate(index, 'manufacturer', manufacturerName)
    
    // Clear any pending timeout
    const existingTimeout = timeoutRefs.current.get('manufacturer')
    if (existingTimeout) {
      clearTimeout(existingTimeout)
      timeoutRefs.current.delete('manufacturer')
    }
  }, [index, onUpdate])

  // Handle keyboard navigation
  const handleManufacturerKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedSuggestionIndex(prev => 
          prev < manufacturerSuggestions.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedSuggestionIndex >= 0) {
          selectSuggestion(manufacturerSuggestions[selectedSuggestionIndex].name)
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
        break
    }
  }, [showSuggestions, manufacturerSuggestions, selectedSuggestionIndex, selectSuggestion])

  const handleChange = useCallback((field: keyof EditableSwitchData, value: any) => {
    setLocalValues(prev => ({ ...prev, [field]: value }))
    
    // Clear existing timeout for this field
    const existingTimeout = timeoutRefs.current.get(field)
    if (existingTimeout) {
      clearTimeout(existingTimeout)
    }
    
    // Set new timeout for debounced update
    const timeoutId = setTimeout(() => {
      onUpdate(index, field, value)
      timeoutRefs.current.delete(field)
    }, 300)
    
    timeoutRefs.current.set(field, timeoutId)
  }, [index, onUpdate])

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          manufacturerInputRef.current && !manufacturerInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    const timeouts = timeoutRefs.current
    return () => {
      timeouts.forEach(timeoutId => clearTimeout(timeoutId))
      timeouts.clear()
    }
  }, [])

  return (
    <tr 
      ref={invalidRowRef}
      className={switchItem.manufacturer && !switchItem.manufacturerValid && !submittedManufacturers.has(switchItem.manufacturer) ? 'bg-red-50 dark:bg-red-900/20' : ''}
    >
      <td className="px-3 py-4">
        <input
          type="text"
          value={localValues.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className="block w-full min-w-[250px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.chineseName || ''}
          onChange={(e) => handleChange('chineseName', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <select
          value={localValues.type || ''}
          onChange={(e) => handleChange('type', e.target.value || undefined)}
          className="block w-full min-w-[160px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
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
          value={localValues.technology || ''}
          onChange={(e) => handleChange('technology', e.target.value || undefined)}
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
            <input
              type="number"
              value={localValues.initialForce || ''}
              onChange={(e) => handleChange('initialForce', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
              min="0"
              max="1000"
              step="0.1"
            />
          </td>
          <td className="px-3 py-4 whitespace-nowrap">
            <input
              type="number"
              value={localValues.initialMagneticFlux || ''}
              onChange={(e) => handleChange('initialMagneticFlux', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
              min="0"
              max="10000"
              step="0.1"
            />
          </td>
          <td className="px-3 py-4 whitespace-nowrap">
            <input
              type="number"
              value={localValues.bottomOutMagneticFlux || ''}
              onChange={(e) => handleChange('bottomOutMagneticFlux', e.target.value ? parseFloat(e.target.value) : undefined)}
              className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
              min="0"
              max="10000"
              step="0.1"
            />
          </td>
          <td className="px-3 py-4 whitespace-nowrap">
            <select
              value={localValues.magnetOrientation || ''}
              onChange={(e) => handleChange('magnetOrientation', e.target.value || undefined)}
              className="block w-full min-w-[140px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
            >
              <option value="">No orientation</option>
              <option value="Horizontal">Horizontal</option>
              <option value="Vertical">Vertical</option>
            </select>
          </td>
          <td className="px-3 py-4 whitespace-nowrap">
            <select
              value={localValues.magnetPosition || ''}
              onChange={(e) => handleChange('magnetPosition', e.target.value || undefined)}
              className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
            >
              <option value="">No position</option>
              <option value="Center">Center</option>
              <option value="Off-Center">Off-Center</option>
            </select>
          </td>
          <td className="px-3 py-4 whitespace-nowrap">
            <select
              value={localValues.pcbThickness || ''}
              onChange={(e) => handleChange('pcbThickness', e.target.value || undefined)}
              className="block w-full min-w-[100px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
            >
              <option value="">No thickness</option>
              <option value="1.2mm">1.2mm</option>
              <option value="1.6mm">1.6mm</option>
            </select>
          </td>
          <td className="px-3 py-4 whitespace-nowrap">
            <select
              value={localValues.magnetPolarity || ''}
              onChange={(e) => handleChange('magnetPolarity', e.target.value || undefined)}
              className="block w-full min-w-[100px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
            >
              <option value="">No polarity</option>
              <option value="North">North</option>
              <option value="South">South</option>
            </select>
          </td>
        </>
      )}
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.compatibility || ''}
          onChange={(e) => handleChange('compatibility', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          placeholder="e.g. MX-style"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <div className="min-w-[200px] relative">
          <input
            ref={manufacturerInputRef}
            type="text"
            value={localValues.manufacturer || ''}
            onChange={(e) => handleManufacturerChange(e.target.value)}
            onKeyDown={handleManufacturerKeyDown}
            className="block w-full text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
            placeholder="Type manufacturer..."
          />
          
          {/* Autocomplete suggestions dropdown */}
          {showSuggestions && manufacturerSuggestions.length > 0 && (
            <div 
              ref={suggestionsRef}
              className="absolute z-50 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg max-h-40 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm"
            >
              {manufacturerSuggestions.map((manufacturer, suggestionIndex) => (
                <div
                  key={manufacturer.id}
                  onClick={() => selectSuggestion(manufacturer.name)}
                  className={`cursor-pointer select-none relative py-2 pl-3 pr-9 ${
                    suggestionIndex === selectedSuggestionIndex
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {manufacturer.name}
                </div>
              ))}
            </div>
          )}
          
          {switchItem.manufacturer && !switchItem.manufacturerValid && !submittedManufacturers.has(switchItem.manufacturer) && (
            <div className="mt-1">
              <p className="text-xs text-red-600 dark:text-red-400">Invalid manufacturer</p>
              {switchItem.manufacturerSuggestions && switchItem.manufacturerSuggestions.length > 0 && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Did you mean: {switchItem.manufacturerSuggestions.join(', ')}?
                </p>
              )}
            </div>
          )}
          {switchItem.manufacturer && submittedManufacturers.has(switchItem.manufacturer) && (
            <div className="mt-1">
              <p className="text-xs text-green-600 dark:text-green-400">✓ Submitted for verification</p>
            </div>
          )}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.springWeight || ''}
          onChange={(e) => handleChange('springWeight', e.target.value)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.springLength || ''}
          onChange={(e) => handleChange('springLength', e.target.value)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.actuationForce || ''}
          onChange={(e) => handleChange('actuationForce', e.target.value ? parseFloat(e.target.value) : undefined)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          min="0"
          max="1000"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.bottomOutForce || ''}
          onChange={(e) => handleChange('bottomOutForce', e.target.value ? parseFloat(e.target.value) : undefined)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          min="0"
          max="1000"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.preTravel || ''}
          onChange={(e) => handleChange('preTravel', e.target.value ? parseFloat(e.target.value) : undefined)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          min="0"
          max="10"
          step="0.1"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.bottomOut || ''}
          onChange={(e) => handleChange('bottomOut', e.target.value ? parseFloat(e.target.value) : undefined)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          min="0"
          max="10"
          step="0.1"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.topHousing || ''}
          onChange={(e) => handleChange('topHousing', e.target.value)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.bottomHousing || ''}
          onChange={(e) => handleChange('bottomHousing', e.target.value)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.stem || ''}
          onChange={(e) => handleChange('stem', e.target.value)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
        />
      </td>
      <td className="px-3 py-4">
        <textarea
          value={localValues.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          rows={2}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="url"
          value={localValues.imageUrl || ''}
          onChange={(e) => handleChange('imageUrl', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="date"
          value={localValues.dateObtained || ''}
          onChange={(e) => handleChange('dateObtained', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
        />
      </td>
    </tr>
  )
})

SwitchEditRow.displayName = 'SwitchEditRow'

export default function BulkEditPage() {
  const [currentStep, setCurrentStep] = useState<BulkEditStep>('loading')
  const [switches, setSwitches] = useState<EditableSwitchData[]>([])
  const [saveProgress, setSaveProgress] = useState(0)
  const [saveResults, setSaveResults] = useState<{ success: number; errors: string[] }>({ success: 0, errors: [] })
  const [isValidating, setIsValidating] = useState(false)
  const [submittedManufacturers, setSubmittedManufacturers] = useState<Set<string>>(new Set())
  const tableRef = useRef<HTMLDivElement>(null)
  const invalidRowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map())

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
            magnetPolarity: sw.magnetPolarity || '',
            initialForce: sw.initialForce || undefined,
            initialMagneticFlux: sw.initialMagneticFlux || undefined,
            bottomOutMagneticFlux: sw.bottomOutMagneticFlux || undefined,
            pcbThickness: sw.pcbThickness || '',
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
          
          // Validate manufacturers
          const manufacturers = editableSwitches.map((sw: EditableSwitchData) => sw.manufacturer || '').filter((m: string) => m)
          const validationResults = await validateManufacturers(manufacturers)
          
          // Add validation results to switches
          const switchesWithValidation = editableSwitches.map((sw: EditableSwitchData) => {
            if (sw.manufacturer) {
              const validationResult = validationResults.get(sw.manufacturer)
              if (validationResult) {
                return {
                  ...sw,
                  manufacturerValid: validationResult.isValid,
                  manufacturerSuggestions: validationResult.suggestions || []
                }
              }
            }
            return { ...sw, manufacturerValid: true }
          })
          
          setSwitches(switchesWithValidation)
          setCurrentStep('editing')
          
          // Scroll to first invalid manufacturer after a short delay
          setTimeout(() => {
            const firstInvalidIndex = switchesWithValidation.findIndex((sw: EditableSwitchData) => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer))
            if (firstInvalidIndex !== -1) {
              const invalidRow = invalidRowRefs.current.get(firstInvalidIndex)
              if (invalidRow) {
                invalidRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }
            }
          }, 100)
        }
      } catch (error) {
        console.error('Failed to fetch switches:', error)
      }
    }
    fetchSwitches()
  }, [submittedManufacturers])

  const updateSwitch = useCallback(async (index: number, field: keyof EditableSwitchData, value: string | number | undefined) => {
    // If manufacturer field is being updated, validate it
    if (field === 'manufacturer' && typeof value === 'string') {
      const validationResults = await validateManufacturers([value])
      const validationResult = validationResults.get(value)
      
      setSwitches(prev => prev.map((sw, i) => {
        if (i !== index) return sw
        
        return {
          ...sw,
          [field]: value,
          manufacturerValid: validationResult?.isValid ?? true,
          manufacturerSuggestions: validationResult?.suggestions || []
        }
      }))
    } else {
      setSwitches(prev => prev.map((sw, i) => 
        i === index ? { ...sw, [field]: value } : sw
      ))
    }
  }, [])

  const handleManufacturerSubmitted = useCallback((name: string) => {
    console.log('New manufacturer submitted:', name)
    setSubmittedManufacturers(prev => new Set(prev).add(name))
  }, [])

  // Check if any switches have MAGNETIC technology to show/hide magnetic fields
  const showMagneticFields = switches.some(sw => sw.technology === 'MAGNETIC')

  const saveSwitches = async () => {
    // Check for invalid manufacturers (excluding submitted ones)
    const invalidManufacturers = switches.filter(sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer))
    if (invalidManufacturers.length > 0) {
      alert(`Cannot save: ${invalidManufacturers.length} switches have invalid manufacturers. Please fix them or submit for verification.`)
      return
    }
    
    setCurrentStep('saving')
    setSaveProgress(0)
    
    const results = { success: 0, errors: [] as string[] }
    
    for (let i = 0; i < switches.length; i++) {
      const switchItem = switches[i]
      
      try {
        const { id, manufacturerValid, manufacturerSuggestions, ...switchData } = switchItem
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
            {switches.some(sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer)) && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                  ⚠️ Some switches have invalid manufacturers. Please fix them before saving.
                </p>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Invalid manufacturers are highlighted in red. Use the autocomplete to select valid manufacturers or submit new ones.
                </p>
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden" style={{ height: 'calc(100vh - 280px)' }}>
            <div className="flex-1 overflow-x-auto overflow-y-auto">
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
                          Initial Force (g)
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Initial Flux (Gs)
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Bottom Out Flux (Gs)
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Pole Orientation
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Magnet Position
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          PCB Thickness
                        </th>
                        <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                          Magnet Polarity
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
                    <SwitchEditRow
                      key={switchItem.id}
                      switchItem={switchItem}
                      index={index}
                      onUpdate={updateSwitch}
                      onManufacturerSubmitted={handleManufacturerSubmitted}
                      submittedManufacturers={submittedManufacturers}
                      showMagneticFields={showMagneticFields}
                      invalidRowRef={(el) => {
                        if (el && switchItem.manufacturer && !switchItem.manufacturerValid && !submittedManufacturers.has(switchItem.manufacturer)) {
                          invalidRowRefs.current.set(index, el)
                        } else {
                          invalidRowRefs.current.delete(index)
                        }
                      }}
                    />
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
                disabled={switches.some(sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer))}
                className={`px-6 py-2 rounded-md ${
                  switches.some(sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer))
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {switches.some(sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer)) ? (
                  `Fix ${switches.filter(sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer)).length} Invalid Manufacturers`
                ) : (
                  `Save All Changes (${switches.length} switches)`
                )}
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
                          magnetPolarity: sw.magnetPolarity || '',
                          initialForce: sw.initialForce || undefined,
                                        initialMagneticFlux: sw.initialMagneticFlux || undefined,
                          bottomOutMagneticFlux: sw.bottomOutMagneticFlux || undefined,
                          pcbThickness: sw.pcbThickness || '',
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
                        
                        // Validate manufacturers
                        const manufacturers = editableSwitches.map((sw: EditableSwitchData) => sw.manufacturer || '').filter((m: string) => m)
                        const validationResults = await validateManufacturers(manufacturers)
                        
                        // Add validation results to switches
                        const switchesWithValidation = editableSwitches.map((sw: EditableSwitchData) => {
                          if (sw.manufacturer) {
                            const validationResult = validationResults.get(sw.manufacturer)
                            if (validationResult) {
                              return {
                                ...sw,
                                manufacturerValid: validationResult.isValid,
                                manufacturerSuggestions: validationResult.suggestions || []
                              }
                            }
                          }
                          return { ...sw, manufacturerValid: true }
                        })
                        
                        setSwitches(switchesWithValidation)
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