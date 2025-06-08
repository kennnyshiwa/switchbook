'use client'

import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
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
  columnOrder,
  invalidRowRef
}: {
  switchItem: EditableSwitchData
  index: number
  onUpdate: (index: number, field: keyof EditableSwitchData, value: string | number | undefined) => void
  onManufacturerSubmitted: (name: string) => void
  submittedManufacturers: Set<string>
  showMagneticFields: boolean
  columnOrder: string[]
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

  // Function to render individual cells based on column configuration
  const renderCell = (columnId: string) => {
    const column = defaultColumns.find(col => col.id === columnId)
    if (!column) return null

    const field = column.field
    const className = `block w-full ${column.minWidth} text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2`
    const isNameColumn = columnId === 'name'

    switch (field) {
      case 'name':
        return (
          <td 
            key={columnId} 
            className={`px-3 py-4 ${isNameColumn ? 'sticky left-0 z-10 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600' : ''}`}
            style={isNameColumn ? { position: 'sticky', left: 0 } : undefined}
          >
            <input
              type="text"
              value={localValues.name}
              onChange={(e) => handleChange('name', e.target.value)}
              className={className}
            />
          </td>
        )

      case 'chineseName':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <input
              type="text"
              value={localValues.chineseName || ''}
              onChange={(e) => handleChange('chineseName', e.target.value)}
              className={className}
            />
          </td>
        )

      case 'type':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <select
              value={localValues.type || ''}
              onChange={(e) => handleChange('type', e.target.value || undefined)}
              className={className}
            >
              <option value="">No type</option>
              <option value="LINEAR">LINEAR</option>
              <option value="TACTILE">TACTILE</option>
              <option value="CLICKY">CLICKY</option>
              <option value="SILENT_LINEAR">SILENT_LINEAR</option>
              <option value="SILENT_TACTILE">SILENT_TACTILE</option>
            </select>
          </td>
        )

      case 'technology':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <select
              value={localValues.technology || ''}
              onChange={(e) => handleChange('technology', e.target.value || undefined)}
              className={className}
            >
              <option value="">No technology</option>
              <option value="MECHANICAL">MECHANICAL</option>
              <option value="OPTICAL">OPTICAL</option>
              <option value="MAGNETIC">MAGNETIC</option>
              <option value="INDUCTIVE">INDUCTIVE</option>
              <option value="ELECTRO_CAPACITIVE">ELECTRO_CAPACITIVE</option>
            </select>
          </td>
        )

      case 'initialForce':
      case 'initialMagneticFlux':
      case 'bottomOutMagneticFlux':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <input
              type="number"
              value={localValues[field] || ''}
              onChange={(e) => handleChange(field, e.target.value ? parseFloat(e.target.value) : undefined)}
              className={className}
              min="0"
              max={field === 'initialForce' ? "1000" : "10000"}
              step="0.1"
            />
          </td>
        )

      case 'magnetOrientation':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <select
              value={localValues.magnetOrientation || ''}
              onChange={(e) => handleChange('magnetOrientation', e.target.value || undefined)}
              className={className}
            >
              <option value="">No orientation</option>
              <option value="Horizontal">Horizontal</option>
              <option value="Vertical">Vertical</option>
            </select>
          </td>
        )

      case 'magnetPosition':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <select
              value={localValues.magnetPosition || ''}
              onChange={(e) => handleChange('magnetPosition', e.target.value || undefined)}
              className={className}
            >
              <option value="">No position</option>
              <option value="Center">Center</option>
              <option value="Off-Center">Off-Center</option>
            </select>
          </td>
        )

      case 'pcbThickness':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <select
              value={localValues.pcbThickness || ''}
              onChange={(e) => handleChange('pcbThickness', e.target.value || undefined)}
              className={className}
            >
              <option value="">No thickness</option>
              <option value="1.2mm">1.2mm</option>
              <option value="1.6mm">1.6mm</option>
            </select>
          </td>
        )

      case 'magnetPolarity':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <select
              value={localValues.magnetPolarity || ''}
              onChange={(e) => handleChange('magnetPolarity', e.target.value || undefined)}
              className={className}
            >
              <option value="">No polarity</option>
              <option value="North">North</option>
              <option value="South">South</option>
            </select>
          </td>
        )

      case 'compatibility':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <input
              type="text"
              value={localValues.compatibility || ''}
              onChange={(e) => handleChange('compatibility', e.target.value)}
              className={className}
              placeholder="e.g. MX-style"
            />
          </td>
        )

      case 'manufacturer':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
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
        )

      case 'springWeight':
      case 'springLength':
      case 'topHousing':
      case 'bottomHousing':
      case 'stem':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <input
              type="text"
              value={localValues[field] || ''}
              onChange={(e) => handleChange(field, e.target.value)}
              className={className}
            />
          </td>
        )

      case 'actuationForce':
      case 'bottomOutForce':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <input
              type="number"
              value={localValues[field] || ''}
              onChange={(e) => handleChange(field, e.target.value ? parseFloat(e.target.value) : undefined)}
              className={className}
              min="0"
              max="1000"
            />
          </td>
        )

      case 'preTravel':
      case 'bottomOut':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <input
              type="number"
              value={localValues[field] || ''}
              onChange={(e) => handleChange(field, e.target.value ? parseFloat(e.target.value) : undefined)}
              className={className}
              min="0"
              max="10"
              step="0.1"
            />
          </td>
        )

      case 'notes':
        return (
          <td key={columnId} className="px-3 py-4">
            <textarea
              value={localValues.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              className={className}
              rows={2}
            />
          </td>
        )

      case 'imageUrl':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <input
              type="url"
              value={localValues.imageUrl || ''}
              onChange={(e) => handleChange('imageUrl', e.target.value)}
              className={className}
            />
          </td>
        )

      case 'dateObtained':
        return (
          <td key={columnId} className="px-3 py-4 whitespace-nowrap">
            <input
              type="date"
              value={localValues.dateObtained || ''}
              onChange={(e) => handleChange('dateObtained', e.target.value)}
              className={className}
            />
          </td>
        )

      default:
        return null
    }
  }

  return (
    <tr 
      ref={invalidRowRef}
      className={switchItem.manufacturer && !switchItem.manufacturerValid && !submittedManufacturers.has(switchItem.manufacturer) ? 'bg-red-50 dark:bg-red-900/20' : ''}
    >
      {columnOrder.map(columnId => renderCell(columnId)).filter(Boolean)}
    </tr>
  )
})

SwitchEditRow.displayName = 'SwitchEditRow'

// Column configuration
interface ColumnConfig {
  id: string
  label: string
  field: keyof EditableSwitchData
  minWidth: string
  isRequired?: boolean
  showOnlyForMagnetic?: boolean
}

const defaultColumns: ColumnConfig[] = [
  { id: 'name', label: 'Name*', field: 'name', minWidth: 'min-w-[250px]', isRequired: true },
  { id: 'chineseName', label: 'Chinese Name', field: 'chineseName', minWidth: 'min-w-[120px]' },
  { id: 'type', label: 'Type', field: 'type', minWidth: 'min-w-[160px]' },
  { id: 'technology', label: 'Technology', field: 'technology', minWidth: 'min-w-[180px]' },
  { id: 'initialForce', label: 'Initial Force (g)', field: 'initialForce', minWidth: 'min-w-[80px]', showOnlyForMagnetic: true },
  { id: 'initialMagneticFlux', label: 'Initial Flux (Gs)', field: 'initialMagneticFlux', minWidth: 'min-w-[80px]', showOnlyForMagnetic: true },
  { id: 'bottomOutMagneticFlux', label: 'Bottom Out Flux (Gs)', field: 'bottomOutMagneticFlux', minWidth: 'min-w-[80px]', showOnlyForMagnetic: true },
  { id: 'magnetOrientation', label: 'Pole Orientation', field: 'magnetOrientation', minWidth: 'min-w-[140px]', showOnlyForMagnetic: true },
  { id: 'magnetPosition', label: 'Magnet Position', field: 'magnetPosition', minWidth: 'min-w-[120px]', showOnlyForMagnetic: true },
  { id: 'pcbThickness', label: 'PCB Thickness', field: 'pcbThickness', minWidth: 'min-w-[100px]', showOnlyForMagnetic: true },
  { id: 'magnetPolarity', label: 'Magnet Polarity', field: 'magnetPolarity', minWidth: 'min-w-[100px]', showOnlyForMagnetic: true },
  { id: 'compatibility', label: 'Compatibility', field: 'compatibility', minWidth: 'min-w-[120px]' },
  { id: 'manufacturer', label: 'Manufacturer', field: 'manufacturer', minWidth: 'min-w-[200px]' },
  { id: 'springWeight', label: 'Spring Weight', field: 'springWeight', minWidth: 'min-w-[80px]' },
  { id: 'springLength', label: 'Spring Length', field: 'springLength', minWidth: 'min-w-[80px]' },
  { id: 'actuationForce', label: 'Actuation Force (g)', field: 'actuationForce', minWidth: 'min-w-[80px]' },
  { id: 'bottomOutForce', label: 'Bottom Out Force (g)', field: 'bottomOutForce', minWidth: 'min-w-[80px]' },
  { id: 'preTravel', label: 'Pre-travel (mm)', field: 'preTravel', minWidth: 'min-w-[80px]' },
  { id: 'bottomOut', label: 'Bottom Out (mm)', field: 'bottomOut', minWidth: 'min-w-[80px]' },
  { id: 'topHousing', label: 'Top Housing', field: 'topHousing', minWidth: 'min-w-[80px]' },
  { id: 'bottomHousing', label: 'Bottom Housing', field: 'bottomHousing', minWidth: 'min-w-[80px]' },
  { id: 'stem', label: 'Stem', field: 'stem', minWidth: 'min-w-[80px]' },
  { id: 'notes', label: 'Notes', field: 'notes', minWidth: 'min-w-[120px]' },
  { id: 'imageUrl', label: 'Image URL', field: 'imageUrl', minWidth: 'min-w-[120px]' },
  { id: 'dateObtained', label: 'Date Obtained', field: 'dateObtained', minWidth: 'min-w-[120px]' },
]

export default function BulkEditPage() {
  const [currentStep, setCurrentStep] = useState<BulkEditStep>('loading')
  const [switches, setSwitches] = useState<EditableSwitchData[]>([])
  const [saveProgress, setSaveProgress] = useState(0)
  const [saveResults, setSaveResults] = useState<{ success: number; errors: string[] }>({ success: 0, errors: [] })
  const [isValidating, setIsValidating] = useState(false)
  const [submittedManufacturers, setSubmittedManufacturers] = useState<Set<string>>(new Set())
  const [columnOrder, setColumnOrder] = useState<string[]>(defaultColumns.map(col => col.id))
  const [draggedColumn, setDraggedColumn] = useState<string | null>(null)
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(new Set(defaultColumns.map(col => col.id)))
  const [searchTerm, setSearchTerm] = useState<string>('')
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('')
  const [isSearching, setIsSearching] = useState<boolean>(false)
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

  // Drag and drop handlers
  const handleDragStart = useCallback((e: React.DragEvent<HTMLTableHeaderCellElement>, columnId: string) => {
    setDraggedColumn(columnId)
    e.dataTransfer.effectAllowed = 'move'
    
    // Optimize drag performance
    if (tableRef.current) {
      tableRef.current.style.pointerEvents = 'none'
    }
    
    // Add ghost image
    const dragImage = document.createElement('div')
    dragImage.textContent = defaultColumns.find(col => col.id === columnId)?.label || columnId
    dragImage.style.cssText = 'position: absolute; top: -1000px; padding: 8px; background: white; border: 1px solid #ccc; border-radius: 4px;'
    document.body.appendChild(dragImage)
    e.dataTransfer.setDragImage(dragImage, 0, 0)
    
    // Clean up ghost image after drag starts
    setTimeout(() => document.body.removeChild(dragImage), 0)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent<HTMLTableHeaderCellElement>) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLTableHeaderCellElement>, targetColumnId: string) => {
    e.preventDefault()
    
    // Prevent dropping on the name column or dropping the name column
    if (!draggedColumn || draggedColumn === targetColumnId || targetColumnId === 'name' || draggedColumn === 'name') {
      setDraggedColumn(null)
      return
    }

    // Use requestAnimationFrame for smooth state updates
    requestAnimationFrame(() => {
      const newColumnOrder = [...columnOrder]
      const draggedIndex = newColumnOrder.indexOf(draggedColumn)
      const targetIndex = newColumnOrder.indexOf(targetColumnId)
      
      // Remove dragged column and insert at target position
      newColumnOrder.splice(draggedIndex, 1)
      newColumnOrder.splice(targetIndex, 0, draggedColumn)
      
      setColumnOrder(newColumnOrder)
      setDraggedColumn(null)
    })
  }, [draggedColumn, columnOrder])

  const handleDragEnd = useCallback(() => {
    setDraggedColumn(null)
    
    // Re-enable pointer events
    if (tableRef.current) {
      tableRef.current.style.pointerEvents = 'auto'
    }
  }, [])

  // Check if any switches have MAGNETIC technology to show/hide magnetic fields
  const showMagneticFields = switches.some(sw => sw.technology === 'MAGNETIC')

  // Toggle column visibility
  const toggleColumnVisibility = useCallback((columnId: string) => {
    // Prevent hiding the name column (required)
    if (columnId === 'name') return
    
    setVisibleColumns(prev => {
      const newVisible = new Set(prev)
      if (newVisible.has(columnId)) {
        newVisible.delete(columnId)
      } else {
        newVisible.add(columnId)
      }
      return newVisible
    })
  }, [])

  // Get filtered columns based on visibility and magnetic field settings
  const getVisibleColumns = useCallback(() => {
    return columnOrder.filter(columnId => {
      const column = defaultColumns.find(col => col.id === columnId)
      if (!column) return false
      
      // Always show name column
      if (columnId === 'name') return true
      
      // Check if column is marked as visible
      if (!visibleColumns.has(columnId)) return false
      
      // Skip magnetic fields if not showing them
      if (column.showOnlyForMagnetic && !showMagneticFields) return false
      
      return true
    })
  }, [columnOrder, visibleColumns, showMagneticFields])

  const visibleColumnIds = getVisibleColumns()

  // Memoized search input handler
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }, [])

  // Debounce search term to improve performance
  useEffect(() => {
    if (searchTerm !== debouncedSearchTerm) {
      setIsSearching(true)
    }
    
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setIsSearching(false)
    }, 150) // Reduced to 150ms for better responsiveness
    
    return () => {
      clearTimeout(timer)
      setIsSearching(false)
    }
  }, [searchTerm, debouncedSearchTerm])

  // Pre-compute searchable text for each switch to optimize filtering
  const switchesWithSearchText = useMemo(() => {
    return switches.map(switchItem => ({
      ...switchItem,
      searchText: [
        switchItem.name,
        switchItem.chineseName,
        switchItem.manufacturer,
        switchItem.type,
        switchItem.technology,
        switchItem.compatibility,
        switchItem.notes,
        switchItem.topHousing,
        switchItem.bottomHousing,
        switchItem.stem,
        switchItem.springWeight,
        switchItem.springLength
      ].filter(Boolean).join(' ').toLowerCase()
    }))
  }, [switches])

  // Filter switches based on debounced search term with result limiting
  const filteredSwitches = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return switches
    
    const searchLower = debouncedSearchTerm.toLowerCase().trim()
    const filtered = switchesWithSearchText
      .filter(switchItem => switchItem.searchText.includes(searchLower))
      .map(({ searchText, ...switchItem }) => switchItem) // Remove searchText from result
    
    // Limit results to improve performance with large datasets
    return filtered.length > 100 ? filtered.slice(0, 100) : filtered
  }, [switchesWithSearchText, debouncedSearchTerm, switches])

  const saveSwitches = async () => {
    // Check for invalid manufacturers (excluding submitted ones) - use all switches, not just filtered
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
      <div className="h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
        <div className="w-full mx-auto p-6 flex flex-col flex-1">
          <div className="mb-6">
            <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center mb-4">
              ← Back to Dashboard
            </Link>
            <div className="flex justify-between items-start">
              <div className="flex-1 mr-6">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Edit Switches</h1>
                <p className="text-gray-600 dark:text-gray-300">
                  Edit your {switches.length} switches in bulk
                  {debouncedSearchTerm && (
                    <span className="block text-sm mt-1">
                      {(() => {
                        const totalFiltered = switchesWithSearchText.filter(item => 
                          item.searchText.includes(debouncedSearchTerm.toLowerCase().trim())
                        ).length
                        const isLimited = totalFiltered > 100
                        return isLimited 
                          ? `Showing first 100 of ${totalFiltered} matches (${switches.length} total)`
                          : `Showing ${filteredSwitches.length} of ${switches.length} switches`
                      })()
                      }
                    </span>
                  )}
                </p>
                
                {/* Search Input */}
                <div className="mt-4 relative max-w-md">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    {isSearching ? (
                      <svg className="h-4 w-4 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    ) : (
                      <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Search switches by name, manufacturer, type..."
                    value={searchTerm}
                    onChange={handleSearchChange}
                    className="block w-full pl-10 pr-10 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-colors duration-150"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>
              
              {/* Column Visibility Controls */}
              <div className="relative">
                <details className="group">
                  <summary className="cursor-pointer px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 flex items-center space-x-2 text-gray-700 dark:text-gray-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                    </svg>
                    <span className="text-sm font-medium">Show/Hide Columns</span>
                    <svg className="w-4 h-4 transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg z-50 max-h-96 overflow-y-auto">
                    <div className="p-3">
                      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                        Toggle Column Visibility
                      </div>
                      <div className="space-y-2">
                        {defaultColumns.map(column => {
                          // Skip magnetic fields if not showing them
                          if (column.showOnlyForMagnetic && !showMagneticFields) return null
                          
                          const isVisible = visibleColumns.has(column.id)
                          const isRequired = column.id === 'name'
                          
                          return (
                            <label key={column.id} className={`flex items-center space-x-2 cursor-pointer p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 ${isRequired ? 'opacity-50' : ''}`}>
                              <input
                                type="checkbox"
                                checked={isVisible}
                                onChange={() => toggleColumnVisibility(column.id)}
                                disabled={isRequired}
                                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">
                                {column.label}
                                {isRequired && <span className="text-xs text-gray-500 ml-1">(required)</span>}
                              </span>
                            </label>
                          )
                        }).filter(Boolean)}
                      </div>
                      
                      <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => setVisibleColumns(new Set(defaultColumns.filter(col => !col.showOnlyForMagnetic || showMagneticFields).map(col => col.id)))}
                            className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            Show All
                          </button>
                          <button
                            onClick={() => setVisibleColumns(new Set(['name']))}
                            className="flex-1 px-2 py-1 text-xs bg-gray-600 text-white rounded hover:bg-gray-700"
                          >
                            Hide All
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </details>
              </div>
            </div>
            {filteredSwitches.some(sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer)) && (
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

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden flex flex-col" style={{ height: 'calc(100vh - 280px)' }}>
            <div className="flex-1 overflow-x-auto overflow-y-auto">
              <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                  <tr>
                    {visibleColumnIds.map((columnId, index) => {
                      const column = defaultColumns.find(col => col.id === columnId)
                      if (!column) return null
                      
                      const isNameColumn = columnId === 'name'
                      
                      return (
                        <th
                          key={columnId}
                          draggable={!isNameColumn}
                          onDragStart={!isNameColumn ? (e) => handleDragStart(e, columnId) : undefined}
                          onDragOver={!isNameColumn ? handleDragOver : undefined}
                          onDrop={!isNameColumn ? (e) => handleDrop(e, columnId) : undefined}
                          onDragEnd={!isNameColumn ? handleDragEnd : undefined}
                          className={`px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${column.minWidth} ${
                            draggedColumn === columnId ? 'opacity-50 transform scale-95' : ''
                          } ${column.isRequired ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${
                            isNameColumn ? 'sticky left-0 z-10 bg-gray-50 dark:bg-gray-700 border-r border-gray-200 dark:border-gray-600' : 'cursor-move hover:bg-gray-100 dark:hover:bg-gray-600'
                          } transition-all duration-150`}
                          style={isNameColumn ? { position: 'sticky', left: 0 } : undefined}
                          title={isNameColumn ? "Name column is always visible" : "Drag to reorder columns"}
                        >
                          <div className="flex items-center space-x-1">
                            <span>{column.label}</span>
                            {!isNameColumn && (
                              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
                              </svg>
                            )}
                            {isNameColumn && (
                              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12l5 5L20 7" />
                              </svg>
                            )}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredSwitches.map((switchItem, index) => (
                    <SwitchEditRow
                      key={switchItem.id}
                      switchItem={switchItem}
                      index={index}
                      onUpdate={updateSwitch}
                      onManufacturerSubmitted={handleManufacturerSubmitted}
                      submittedManufacturers={submittedManufacturers}
                      showMagneticFields={showMagneticFields}
                      columnOrder={visibleColumnIds}
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