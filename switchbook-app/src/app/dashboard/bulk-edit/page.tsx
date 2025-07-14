'use client'

import { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react'
import { Switch, ClickType } from '@prisma/client'
import Link from 'next/link'
import { validateManufacturers, ManufacturerValidationResult } from '@/utils/manufacturerValidation'
import TagsInputWithAutocomplete from '@/components/TagsInputWithAutocomplete'
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  ColumnDef,
  flexRender,
  ColumnOrderState,
} from '@tanstack/react-table'

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
  tactileForce?: number
  tactilePosition?: number
  bottomOutForce?: number
  progressiveSpring?: boolean
  doubleStage?: boolean
  clickType?: string
  preTravel?: number
  bottomOut?: number
  notes?: string
  topHousing?: string
  bottomHousing?: string
  stem?: string
  topHousingColor?: string
  bottomHousingColor?: string
  stemColor?: string
  stemShape?: string
  markings?: string
  frankenTop?: string
  frankenBottom?: string
  frankenStem?: string
  dateObtained?: string
  personalTags?: string[]
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

// Cell component for editable fields
const EditableCell = memo(({
  value,
  field,
  switchId,
  onUpdate,
  type = 'text',
  placeholder = '',
  min,
  max,
  step,
  manufacturers = [],
  onManufacturerSubmitted,
  submittedManufacturers,
  isCheckbox = false,
  isInvalid = false
}: {
  value: any
  field: keyof EditableSwitchData
  switchId: string
  onUpdate: (switchId: string, field: keyof EditableSwitchData, value: string | number | boolean | string[] | undefined) => void
  type?: string
  placeholder?: string
  min?: number
  max?: number
  step?: number
  manufacturers?: { id: string; name: string }[]
  onManufacturerSubmitted?: (name: string) => void
  submittedManufacturers?: Set<string>
  isCheckbox?: boolean
  isInvalid?: boolean
}) => {
  const [localValue, setLocalValue] = useState(value)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [suggestions, setSuggestions] = useState<{ id: string; name: string }[]>([])
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const timeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)

  useEffect(() => {
    setLocalValue(value)
  }, [value])

  const handleChange = useCallback((newValue: any) => {
    setLocalValue(newValue)
    
    // For manufacturer field, handle autocomplete
    if (field === 'manufacturer' && typeof newValue === 'string') {
      if (newValue.length > 0) {
        const filtered = manufacturers.filter(m => 
          m.name.toLowerCase().includes(newValue.toLowerCase())
        ).slice(0, 5)
        setSuggestions(filtered)
        setShowSuggestions(filtered.length > 0)
        setSelectedIndex(-1)
      } else {
        setShowSuggestions(false)
        setSuggestions([])
      }
    }
    
    // Debounce the update
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    
    timeoutRef.current = setTimeout(() => {
      onUpdate(switchId, field, newValue === '' ? undefined : newValue)
    }, 300)
  }, [switchId, field, onUpdate, manufacturers])

  const selectSuggestion = useCallback((suggestion: string) => {
    setLocalValue(suggestion)
    setShowSuggestions(false)
    onUpdate(switchId, field, suggestion)
  }, [switchId, field, onUpdate])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!showSuggestions) return
    
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => prev < suggestions.length - 1 ? prev + 1 : prev)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0) {
          selectSuggestion(suggestions[selectedIndex].name)
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        setSelectedIndex(-1)
        break
    }
  }, [showSuggestions, suggestions, selectedIndex, selectSuggestion])

  if (isCheckbox) {
    return (
      <input
        type="checkbox"
        checked={!!localValue}
        onChange={(e) => handleChange(e.target.checked)}
        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
      />
    )
  }

  return (
    <div className="relative">
      <input
        type={type}
        value={localValue || ''}
        onChange={(e) => handleChange(type === 'number' ? parseFloat(e.target.value) || '' : e.target.value)}
        onKeyDown={field === 'manufacturer' ? handleKeyDown : undefined}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className={`w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 ${
          isInvalid 
            ? 'border-red-500 bg-red-50 dark:bg-red-900/20 focus:ring-red-500' 
            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 focus:ring-blue-500'
        } text-gray-900 dark:text-gray-100`}
      />
      
      {/* Manufacturer autocomplete dropdown */}
      {field === 'manufacturer' && showSuggestions && (
        <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={suggestion.id}
              type="button"
              onClick={() => selectSuggestion(suggestion.name)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                index === selectedIndex ? 'bg-gray-100 dark:bg-gray-700' : ''
              }`}
            >
              {suggestion.name}
            </button>
          ))}
          {localValue && !submittedManufacturers?.has(localValue) && !manufacturers.some(m => m.name === localValue) && (
            <button
              type="button"
              onClick={() => onManufacturerSubmitted?.(localValue)}
              className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-t border-gray-200 dark:border-gray-700"
            >
              Submit &quot;{localValue}&quot; as new manufacturer
            </button>
          )}
        </div>
      )}
    </div>
  )
})

EditableCell.displayName = 'EditableCell'

// Tags cell component for editing tags with autocomplete
const TagsEditableCell = memo(({
  tags,
  switchId,
  onUpdate,
  suggestions = []
}: {
  tags: string[]
  switchId: string
  onUpdate: (switchId: string, field: keyof EditableSwitchData, value: string[] | undefined) => void
  suggestions?: string[]
}) => {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = suggestions
        .filter(suggestion => 
          suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
          !tags.includes(suggestion)
        )
        .slice(0, 5)
      setFilteredSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
      setFilteredSuggestions([])
    }
  }, [inputValue, suggestions, tags])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (showSuggestions && filteredSuggestions.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSuggestionIndex(prev => 
          prev < filteredSuggestions.length - 1 ? prev + 1 : prev
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1)
      } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
        e.preventDefault()
        addTag(filteredSuggestions[selectedSuggestionIndex])
      } else if (e.key === 'Escape') {
        setShowSuggestions(false)
        setSelectedSuggestionIndex(-1)
      }
    }
    
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (selectedSuggestionIndex === -1) {
        addTag(inputValue)
      }
    } else if (e.key === 'Backspace' && inputValue === '' && tags.length > 0) {
      removeTag(tags.length - 1)
    }
  }

  const addTag = (value: string) => {
    const trimmedValue = value.trim()
    if (trimmedValue && !tags.includes(trimmedValue) && tags.length < 10) {
      onUpdate(switchId, 'personalTags', [...tags, trimmedValue])
      setInputValue('')
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    }
  }

  const removeTag = (indexToRemove: number) => {
    const newTags = tags.filter((_, index) => index !== indexToRemove)
    onUpdate(switchId, 'personalTags', newTags.length > 0 ? newTags : undefined)
  }

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center flex-wrap gap-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 min-h-[30px] max-h-[60px] overflow-y-auto">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none ml-0.5"
            >
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? "Add tags..." : ""}
          className="flex-1 min-w-[80px] bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
          disabled={tags.length >= 10}
        />
      </div>
      
      {showSuggestions && (
        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-auto">
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => addTag(suggestion)}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                index === selectedSuggestionIndex ? 'bg-gray-100 dark:bg-gray-600' : ''
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  )
})

TagsEditableCell.displayName = 'TagsEditableCell'

export default function BulkEditPage() {
  const [switches, setSwitches] = useState<EditableSwitchData[]>([])
  const [originalData, setOriginalData] = useState<EditableSwitchData[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentStep, setCurrentStep] = useState<BulkEditStep>('loading')
  const [submittedManufacturers, setSubmittedManufacturers] = useState<Set<string>>(new Set())
  const [invalidSwitches, setInvalidSwitches] = useState<Set<string>>(new Set())
  const [manufacturers, setManufacturers] = useState<{ id: string; name: string }[]>([])
  const [userTags, setUserTags] = useState<string[]>([])
  const [columnOrder, setColumnOrder] = useState<ColumnOrderState>([])
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({})

  // Determine if we should show magnetic fields
  const showMagneticFields = useMemo(() => {
    return switches.some(s => s.technology === 'MAGNETIC')
  }, [switches])

  // Check if we should show tactile force
  const showTactileForce = useMemo(() => {
    return switches.some(s => s.type === 'TACTILE' || s.type === 'SILENT_TACTILE' || s.type === 'CLICKY')
  }, [switches])

  // Check if we should show click type
  const showClickType = useMemo(() => {
    return switches.some(s => s.type === 'CLICKY')
  }, [switches])

  // Track modified switches
  const modifiedSwitches = useMemo(() => {
    const modified = new Set<string>()
    switches.forEach((s, index) => {
      const original = originalData[index]
      if (!original) return
      
      // Compare each field individually to avoid false positives
      const isModified = Object.keys(s).some(key => {
        const sValue = s[key as keyof EditableSwitchData]
        const oValue = original[key as keyof EditableSwitchData]
        
        // Skip validation fields that aren't part of the actual data
        if (key === 'manufacturerValid' || key === 'manufacturerSuggestions') {
          return false
        }
        
        // Handle arrays (personalTags)
        if (Array.isArray(sValue) && Array.isArray(oValue)) {
          return sValue.length !== oValue.length || sValue.some((val, idx) => val !== oValue[idx])
        }
        
        // Handle undefined vs empty string
        if ((sValue === undefined || sValue === '') && (oValue === undefined || oValue === '')) {
          return false
        }
        
        // Handle undefined vs empty array
        if (key === 'personalTags') {
          const sArr = sValue as string[] | undefined
          const oArr = oValue as string[] | undefined
          if ((!sArr || sArr.length === 0) && (!oArr || oArr.length === 0)) {
            return false
          }
        }
        
        return sValue !== oValue
      })
      
      if (isModified) {
        modified.add(s.id)
      }
    })
    return modified
  }, [switches, originalData])

  const loadSwitches = useCallback(async () => {
    try {
      const response = await fetch('/api/switches')
      if (response.ok) {
        const data: Switch[] = await response.json()
        const editableData: EditableSwitchData[] = data.map(sw => ({
          id: sw.id,
          name: sw.name,
          chineseName: sw.chineseName || undefined,
          type: sw.type || undefined,
          technology: sw.technology || undefined,
          magnetOrientation: sw.magnetOrientation || undefined,
          magnetPosition: sw.magnetPosition || undefined,
          magnetPolarity: sw.magnetPolarity || undefined,
          initialForce: sw.initialForce || undefined,
          initialMagneticFlux: sw.initialMagneticFlux || undefined,
          bottomOutMagneticFlux: sw.bottomOutMagneticFlux || undefined,
          pcbThickness: sw.pcbThickness || undefined,
          compatibility: sw.compatibility || undefined,
          manufacturer: sw.manufacturer || undefined,
          springWeight: sw.springWeight || undefined,
          springLength: sw.springLength || undefined,
          actuationForce: sw.actuationForce || undefined,
          tactileForce: sw.tactileForce || undefined,
          tactilePosition: sw.tactilePosition || undefined,
          bottomOutForce: sw.bottomOutForce || undefined,
          progressiveSpring: sw.progressiveSpring || undefined,
          doubleStage: sw.doubleStage || undefined,
          clickType: sw.clickType || undefined,
          preTravel: sw.preTravel || undefined,
          bottomOut: sw.bottomOut || undefined,
          notes: sw.notes || undefined,
          topHousing: sw.topHousing || undefined,
          bottomHousing: sw.bottomHousing || undefined,
          stem: sw.stem || undefined,
          topHousingColor: sw.topHousingColor || undefined,
          bottomHousingColor: sw.bottomHousingColor || undefined,
          stemColor: sw.stemColor || undefined,
          stemShape: sw.stemShape || undefined,
          markings: sw.markings || undefined,
          frankenTop: sw.frankenTop || undefined,
          frankenBottom: sw.frankenBottom || undefined,
          frankenStem: sw.frankenStem || undefined,
          dateObtained: sw.dateObtained ? new Date(sw.dateObtained).toISOString().split('T')[0] : undefined,
          personalTags: sw.personalTags || undefined,
        }))
        setSwitches(editableData)
        // Store original data without validation fields
        const originalDataCopy = editableData.map(item => {
          const { manufacturerValid, manufacturerSuggestions, ...dataWithoutValidation } = item
          return dataWithoutValidation
        })
        setOriginalData(JSON.parse(JSON.stringify(originalDataCopy)))
        
        // Extract all unique tags from user's switches
        const allTags = new Set<string>()
        editableData.forEach(switchData => {
          if (switchData.personalTags && Array.isArray(switchData.personalTags)) {
            switchData.personalTags.forEach(tag => allTags.add(tag))
          }
        })
        setUserTags(Array.from(allTags).sort())
        
        // Set default column order
        const defaultOrder = [
          'name',
          'chineseName',
          'manufacturer',
          'type',
          'technology',
          'actuationForce',
          'tactileForce',
          'tactilePosition',
          'bottomOutForce',
          'preTravel',
          'bottomOut',
          'springWeight',
          'springLength',
          'progressiveSpring',
          'doubleStage',
          'clickType',
          'topHousing',
          'bottomHousing',
          'stem',
          'topHousingColor',
          'bottomHousingColor',
          'stemColor',
          'stemShape',
          'markings',
          'compatibility',
          'notes',
          'dateObtained',
          'magnetOrientation',
          'magnetPosition',
          'magnetPolarity',
          'initialForce',
          'initialMagneticFlux',
          'bottomOutMagneticFlux',
          'pcbThickness',
          'frankenTop',
          'frankenBottom',
          'frankenStem',
          'personalTags'
        ]
        setColumnOrder(defaultOrder)
        
        // Set default visibility
        const defaultVisibility: Record<string, boolean> = {}
        defaultOrder.forEach(col => {
          defaultVisibility[col] = true
        })
        // Hide some columns by default
        defaultVisibility.frankenTop = false
        defaultVisibility.frankenBottom = false
        defaultVisibility.frankenStem = false
        defaultVisibility.clickType = false
        defaultVisibility.tactilePosition = false
        defaultVisibility.magnetOrientation = false
        defaultVisibility.magnetPosition = false
        defaultVisibility.magnetPolarity = false
        defaultVisibility.initialForce = false
        defaultVisibility.initialMagneticFlux = false
        defaultVisibility.bottomOutMagneticFlux = false
        defaultVisibility.pcbThickness = false
        defaultVisibility.personalTags = true
        setColumnVisibility(defaultVisibility)
        
        // Validate manufacturers
        const manufacturerNames = editableData
          .map(s => s.manufacturer)
          .filter((m): m is string => !!m)
        
        validateManufacturers(manufacturerNames).then(validationResults => {
          const invalidIds = new Set<string>()
          const updates: EditableSwitchData[] = []
          
          editableData.forEach(switchData => {
            if (switchData.manufacturer) {
              const result = validationResults.get(switchData.manufacturer)
              if (result) {
                if (!result.isValid) {
                  invalidIds.add(switchData.id)
                  switchData.manufacturerValid = false
                  switchData.manufacturerSuggestions = result.suggestions
                  updates.push(switchData)
                } else {
                  switchData.manufacturerValid = true
                  switchData.manufacturerSuggestions = []
                  updates.push(switchData)
                }
              }
            }
          })
          
          if (updates.length > 0) {
            setSwitches(prev => {
              const newData = [...prev]
              updates.forEach(update => {
                const index = newData.findIndex(s => s.id === update.id)
                if (index !== -1) {
                  newData[index] = update
                }
              })
              return newData
            })
          }
          
          setInvalidSwitches(invalidIds)
        })
        
        setCurrentStep('editing')
      }
    } catch (error) {
      console.error('Failed to load switches:', error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSwitches()
    fetchManufacturers().then(setManufacturers)
    // Fetch user tags for autocomplete
    fetch('/api/user/tags')
      .then(res => res.json())
      .then(data => setUserTags(data.tags || []))
      .catch(err => console.error('Failed to fetch user tags:', err))
  }, [])

  const updateSwitch = useCallback((switchId: string, field: keyof EditableSwitchData, value: string | number | boolean | string[] | undefined) => {
    setSwitches(prev => prev.map(s => 
      s.id === switchId ? { ...s, [field]: value } : s
    ))
  }, [])

  const handleManufacturerSubmitted = useCallback((name: string) => {
    setSubmittedManufacturers(prev => new Set([...prev, name]))
    // Optionally submit to API here
  }, [])

  const saveSwitches = async () => {
    setCurrentStep('saving')
    setSaving(true)
    
    try {
      // Only save modified switches
      const modifiedData = switches.filter(s => modifiedSwitches.has(s.id))
      
      if (modifiedData.length === 0) {
        alert('No changes to save')
        setCurrentStep('editing')
        setSaving(false)
        return
      }
      
      // Prepare the data for saving
      const dataToSave = modifiedData.map(({ 
        manufacturerValid, 
        manufacturerSuggestions, 
        dateObtained,
        progressiveSpring = false,
        doubleStage = false,
        personalTags = [],
        ...rest 
      }) => ({
        ...rest,
        progressiveSpring,
        doubleStage,
        personalTags,
        dateObtained: dateObtained || ''
      }))
      
      const response = await fetch('/api/switches/bulk', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ switches: dataToSave })
      })

      if (response.ok) {
        setCurrentStep('complete')
      } else {
        const error = await response.text()
        alert(`Failed to save switches: ${error}`)
        setCurrentStep('editing')
      }
    } catch (error) {
      console.error('Failed to save switches:', error)
      alert('Failed to save switches')
      setCurrentStep('editing')
    } finally {
      setSaving(false)
    }
  }

  // Define columns with React Table
  const columns = useMemo<ColumnDef<EditableSwitchData>[]>(() => {
    const cols: ColumnDef<EditableSwitchData>[] = [
      {
        id: 'name',
        accessorKey: 'name',
        header: 'Name',
        size: 200,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.name}
            field="name"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="Switch name"
            isInvalid={invalidSwitches.has(row.original.id)}
          />
        ),
      },
      {
        id: 'chineseName',
        accessorKey: 'chineseName',
        header: 'Chinese Name',
        size: 150,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.chineseName}
            field="chineseName"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="中文名"
          />
        ),
      },
      {
        id: 'manufacturer',
        accessorKey: 'manufacturer',
        header: () => (
          <span className="inline-flex items-center gap-1">
            Manufacturer
            <span className="relative group">
              <svg 
                className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                />
              </svg>
              <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-56 p-2 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg z-10">
                If you don&apos;t know the manufacturer, you can enter &quot;Unknown&quot; in this field.
                <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></span>
              </span>
            </span>
          </span>
        ),
        size: 150,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.manufacturer}
            field="manufacturer"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="Manufacturer"
            manufacturers={manufacturers}
            onManufacturerSubmitted={handleManufacturerSubmitted}
            submittedManufacturers={submittedManufacturers}
            isInvalid={row.original.manufacturerValid === false}
          />
        ),
      },
      {
        id: 'type',
        accessorKey: 'type',
        header: 'Type',
        size: 120,
        cell: ({ row }) => (
          <select
            value={row.original.type || ''}
            onChange={(e) => updateSwitch(row.original.id, 'type', e.target.value || undefined)}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="">-</option>
            <option value="LINEAR">Linear</option>
            <option value="TACTILE">Tactile</option>
            <option value="CLICKY">Clicky</option>
            <option value="SILENT_LINEAR">Silent Linear</option>
            <option value="SILENT_TACTILE">Silent Tactile</option>
          </select>
        ),
      },
      {
        id: 'technology',
        accessorKey: 'technology',
        header: 'Technology',
        size: 130,
        cell: ({ row }) => (
          <select
            value={row.original.technology || ''}
            onChange={(e) => updateSwitch(row.original.id, 'technology', e.target.value || undefined)}
            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
          >
            <option value="">-</option>
            <option value="MECHANICAL">Mechanical</option>
            <option value="OPTICAL">Optical</option>
            <option value="MAGNETIC">Magnetic</option>
            <option value="INDUCTIVE">Inductive</option>
            <option value="ELECTRO_CAPACITIVE">Electro Capacitive</option>
          </select>
        ),
      },
      {
        id: 'actuationForce',
        accessorKey: 'actuationForce',
        header: 'Actuation (g)',
        size: 100,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.actuationForce}
            field="actuationForce"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            type="number"
            min={0}
            max={1000}
            step={0.1}
          />
        ),
      },
    ]

    // Add tactile force column if needed
    if (showTactileForce) {
      cols.push({
        id: 'tactileForce',
        accessorKey: 'tactileForce',
        header: 'Tactile (g)',
        size: 100,
        cell: ({ row }) => {
          const isVisible = row.original.type === 'TACTILE' || row.original.type === 'SILENT_TACTILE' || row.original.type === 'CLICKY'
          return isVisible ? (
            <EditableCell
              value={row.original.tactileForce}
              field="tactileForce"
              switchId={row.original.id}
              onUpdate={updateSwitch}
              type="number"
              min={0}
              max={1000}
              step={0.1}
            />
          ) : null
        },
      })
    }

    // Add tactile position column if needed  
    const showTactilePosition = switches.some(s => s.type === 'TACTILE' || s.type === 'SILENT_TACTILE' || s.type === 'CLICKY')
    if (showTactilePosition) {
      cols.push({
        id: 'tactilePosition',
        accessorKey: 'tactilePosition',
        header: 'Tactile Position (mm)',
        size: 120,
        cell: ({ row }) => {
          const isVisible = row.original.type === 'TACTILE' || row.original.type === 'SILENT_TACTILE' || row.original.type === 'CLICKY'
          return isVisible ? (
            <EditableCell
              value={row.original.tactilePosition}
              field="tactilePosition"
              switchId={row.original.id}
              onUpdate={updateSwitch}
              type="number"
              step={0.1}
              min={0}
              max={10}
              placeholder="0.3, 1.5"
            />
          ) : null
        },
      })
    }

    // Add remaining columns
    cols.push(
      {
        id: 'bottomOutForce',
        accessorKey: 'bottomOutForce',
        header: 'Bottom Out (g)',
        size: 100,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.bottomOutForce}
            field="bottomOutForce"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            type="number"
            min={0}
            max={1000}
            step={0.1}
          />
        ),
      },
      {
        id: 'preTravel',
        accessorKey: 'preTravel',
        header: 'Pre Travel',
        size: 100,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.preTravel}
            field="preTravel"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            type="number"
            min={0}
            max={10}
            step={0.01}
          />
        ),
      },
      {
        id: 'bottomOut',
        accessorKey: 'bottomOut',
        header: 'Total Travel',
        size: 100,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.bottomOut}
            field="bottomOut"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            type="number"
            min={0}
            max={10}
            step={0.01}
          />
        ),
      },
      {
        id: 'springWeight',
        accessorKey: 'springWeight',
        header: 'Spring Weight',
        size: 100,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.springWeight}
            field="springWeight"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="e.g., 62g"
          />
        ),
      },
      {
        id: 'springLength',
        accessorKey: 'springLength',
        header: 'Spring Length',
        size: 100,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.springLength}
            field="springLength"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="e.g., 14mm"
          />
        ),
      },
      {
        id: 'progressiveSpring',
        accessorKey: 'progressiveSpring',
        header: 'Progressive',
        size: 80,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.progressiveSpring}
            field="progressiveSpring"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            isCheckbox={true}
          />
        ),
      },
      {
        id: 'doubleStage',
        accessorKey: 'doubleStage',
        header: 'Double Stage',
        size: 80,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.doubleStage}
            field="doubleStage"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            isCheckbox={true}
          />
        ),
      },
    )

    // Add click type column if needed
    if (showClickType) {
      cols.push({
        id: 'clickType',
        accessorKey: 'clickType',
        header: 'Click Type',
        size: 120,
        cell: ({ row }) => {
          const isVisible = row.original.type === 'CLICKY'
          return isVisible ? (
            <select
              value={row.original.clickType || ''}
              onChange={(e) => updateSwitch(row.original.id, 'clickType', e.target.value || undefined)}
              className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="">-</option>
              <option value="CLICK_LEAF">Click Leaf</option>
              <option value="CLICK_BAR">Click Bar</option>
              <option value="CLICK_JACKET">Click Jacket</option>
            </select>
          ) : null
        },
      })
    }

    // Add remaining columns
    cols.push(
      {
        id: 'topHousing',
        accessorKey: 'topHousing',
        header: 'Top Housing',
        size: 120,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.topHousing}
            field="topHousing"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="e.g., PC"
          />
        ),
      },
      {
        id: 'bottomHousing',
        accessorKey: 'bottomHousing',
        header: 'Bottom Housing',
        size: 120,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.bottomHousing}
            field="bottomHousing"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="e.g., Nylon"
          />
        ),
      },
      {
        id: 'stem',
        accessorKey: 'stem',
        header: 'Stem',
        size: 120,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.stem}
            field="stem"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="e.g., POM"
          />
        ),
      },
      {
        id: 'topHousingColor',
        accessorKey: 'topHousingColor',
        header: 'Top Color',
        size: 100,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.topHousingColor}
            field="topHousingColor"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="e.g., Clear"
          />
        ),
      },
      {
        id: 'bottomHousingColor',
        accessorKey: 'bottomHousingColor',
        header: 'Bottom Color',
        size: 100,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.bottomHousingColor}
            field="bottomHousingColor"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="e.g., Black"
          />
        ),
      },
      {
        id: 'stemColor',
        accessorKey: 'stemColor',
        header: 'Stem Color',
        size: 100,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.stemColor}
            field="stemColor"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="e.g., Red"
          />
        ),
      },
      {
        id: 'stemShape',
        accessorKey: 'stemShape',
        header: 'Stem Shape',
        size: 100,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.stemShape}
            field="stemShape"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="e.g., MX"
          />
        ),
      },
      {
        id: 'markings',
        accessorKey: 'markings',
        header: 'Markings',
        size: 150,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.markings}
            field="markings"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="e.g., Logo on top"
          />
        ),
      },
      {
        id: 'compatibility',
        accessorKey: 'compatibility',
        header: 'Compatibility',
        size: 120,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.compatibility}
            field="compatibility"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="e.g., MX"
          />
        ),
      },
      {
        id: 'notes',
        accessorKey: 'notes',
        header: 'Notes',
        size: 200,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.notes}
            field="notes"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="Notes..."
          />
        ),
      },
      {
        id: 'dateObtained',
        accessorKey: 'dateObtained',
        header: 'Date Obtained',
        size: 120,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.dateObtained}
            field="dateObtained"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            type="date"
          />
        ),
      },
    )

    // Add magnetic fields if needed
    if (showMagneticFields) {
      cols.push(
        {
          id: 'magnetOrientation',
          accessorKey: 'magnetOrientation',
          header: 'Magnet Orient.',
          size: 120,
          cell: ({ row }) => {
            const isVisible = row.original.technology === 'MAGNETIC'
            return isVisible ? (
              <select
                value={row.original.magnetOrientation || ''}
                onChange={(e) => updateSwitch(row.original.id, 'magnetOrientation', e.target.value || undefined)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">-</option>
                <option value="Horizontal">Horizontal</option>
                <option value="Vertical">Vertical</option>
              </select>
            ) : null
          },
        },
        {
          id: 'magnetPosition',
          accessorKey: 'magnetPosition',
          header: 'Magnet Pos.',
          size: 120,
          cell: ({ row }) => {
            const isVisible = row.original.technology === 'MAGNETIC'
            return isVisible ? (
              <select
                value={row.original.magnetPosition || ''}
                onChange={(e) => updateSwitch(row.original.id, 'magnetPosition', e.target.value || undefined)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">-</option>
                <option value="Center">Center</option>
                <option value="Off-Center">Off-Center</option>
              </select>
            ) : null
          },
        },
        {
          id: 'magnetPolarity',
          accessorKey: 'magnetPolarity',
          header: 'Magnet Polarity',
          size: 120,
          cell: ({ row }) => {
            const isVisible = row.original.technology === 'MAGNETIC'
            return isVisible ? (
              <select
                value={row.original.magnetPolarity || ''}
                onChange={(e) => updateSwitch(row.original.id, 'magnetPolarity', e.target.value || undefined)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">-</option>
                <option value="North">North</option>
                <option value="South">South</option>
              </select>
            ) : null
          },
        },
        {
          id: 'initialForce',
          accessorKey: 'initialForce',
          header: 'Initial Force',
          size: 100,
          cell: ({ row }) => {
            const isVisible = row.original.technology === 'MAGNETIC'
            return isVisible ? (
              <EditableCell
                value={row.original.initialForce}
                field="initialForce"
                switchId={row.original.id}
                onUpdate={updateSwitch}
                type="number"
                min={0}
                max={1000}
                step={0.1}
              />
            ) : null
          },
        },
        {
          id: 'initialMagneticFlux',
          accessorKey: 'initialMagneticFlux',
          header: 'Initial Flux',
          size: 100,
          cell: ({ row }) => {
            const isVisible = row.original.technology === 'MAGNETIC'
            return isVisible ? (
              <EditableCell
                value={row.original.initialMagneticFlux}
                field="initialMagneticFlux"
                switchId={row.original.id}
                onUpdate={updateSwitch}
                type="number"
                min={0}
                max={10000}
                step={0.1}
              />
            ) : null
          },
        },
        {
          id: 'bottomOutMagneticFlux',
          accessorKey: 'bottomOutMagneticFlux',
          header: 'Bottom Flux',
          size: 100,
          cell: ({ row }) => {
            const isVisible = row.original.technology === 'MAGNETIC'
            return isVisible ? (
              <EditableCell
                value={row.original.bottomOutMagneticFlux}
                field="bottomOutMagneticFlux"
                switchId={row.original.id}
                onUpdate={updateSwitch}
                type="number"
                min={0}
                max={10000}
                step={0.1}
              />
            ) : null
          },
        },
        {
          id: 'pcbThickness',
          accessorKey: 'pcbThickness',
          header: 'PCB Thickness',
          size: 100,
          cell: ({ row }) => {
            const isVisible = row.original.technology === 'MAGNETIC'
            return isVisible ? (
              <select
                value={row.original.pcbThickness || ''}
                onChange={(e) => updateSwitch(row.original.id, 'pcbThickness', e.target.value || undefined)}
                className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              >
                <option value="">-</option>
                <option value="1.2mm">1.2mm</option>
                <option value="1.6mm">1.6mm</option>
              </select>
            ) : null
          },
        },
      )
    }

    // Add personal tags column
    cols.push(
      {
        id: 'personalTags',
        accessorKey: 'personalTags',
        header: 'Personal Tags',
        size: 250,
        cell: ({ row }) => (
          <TagsEditableCell
            tags={row.original.personalTags || []}
            switchId={row.original.id}
            onUpdate={updateSwitch}
            suggestions={userTags}
          />
        ),
      },
    )

    // Add frankenswitch columns
    cols.push(
      {
        id: 'frankenTop',
        accessorKey: 'frankenTop',
        header: 'Franken Top',
        size: 120,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.frankenTop}
            field="frankenTop"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="Top housing"
          />
        ),
      },
      {
        id: 'frankenBottom',
        accessorKey: 'frankenBottom',
        header: 'Franken Bottom',
        size: 120,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.frankenBottom}
            field="frankenBottom"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="Bottom housing"
          />
        ),
      },
      {
        id: 'frankenStem',
        accessorKey: 'frankenStem',
        header: 'Franken Stem',
        size: 120,
        cell: ({ row }) => (
          <EditableCell
            value={row.original.frankenStem}
            field="frankenStem"
            switchId={row.original.id}
            onUpdate={updateSwitch}
            placeholder="Stem"
          />
        ),
      },
    )

    return cols
  }, [updateSwitch, manufacturers, handleManufacturerSubmitted, submittedManufacturers, invalidSwitches, showMagneticFields, showTactileForce, showClickType, userTags])

  // Create table instance
  const table = useReactTable({
    data: switches,
    columns,
    state: {
      columnOrder,
      columnVisibility,
    },
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  })

  if (currentStep === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading switches...</p>
        </div>
      </div>
    )
  }

  if (currentStep === 'complete') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <svg className="w-16 h-16 text-green-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Changes Saved Successfully!</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">All switch data has been updated.</p>
          <Link
            href="/dashboard"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Bulk Edit Switches</h1>
              <p className="mt-2 text-gray-600 dark:text-gray-400">
                Edit multiple switches at once. Changes are saved when you click &quot;Save All Changes&quot;.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              {modifiedSwitches.size > 0 && (
                <span className="text-sm text-blue-600 dark:text-blue-400">
                  {modifiedSwitches.size} switch{modifiedSwitches.size !== 1 ? 'es' : ''} modified
                </span>
              )}
              <Link
                href="/dashboard"
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
              >
                Cancel
              </Link>
              <button
                onClick={saveSwitches}
                disabled={saving || modifiedSwitches.size === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : `Save ${modifiedSwitches.size > 0 ? modifiedSwitches.size : 'All'} Changes`}
              </button>
            </div>
          </div>
        </div>

        {/* Column Controls */}
        <div className="mb-4 bg-white dark:bg-gray-800 rounded-lg shadow p-4">
          <details className="cursor-pointer">
            <summary className="font-medium text-gray-900 dark:text-white">Column Settings</summary>
            <div className="mt-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Show/Hide Columns</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {columnOrder.map(colId => (
                    <label key={colId} className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={columnVisibility[colId] !== false}
                        onChange={(e) => setColumnVisibility(prev => ({ ...prev, [colId]: e.target.checked }))}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {(() => {
                          const column = columns.find(c => c.id === colId)
                          if (!column) return colId
                          if (typeof column.header === 'string') return column.header
                          if (colId === 'manufacturer') return 'Manufacturer'
                          return colId
                        })()}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              
              <div>
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Reorder Columns (Drag to rearrange)</h3>
                <div className="space-y-1 max-h-60 overflow-y-auto">
                  {columnOrder.map((colId, index) => {
                    const column = columns.find(c => c.id === colId)
                    const isVisible = columnVisibility[colId] !== false
                    return (
                      <div
                        key={colId}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.effectAllowed = 'move'
                          e.dataTransfer.setData('text/plain', index.toString())
                        }}
                        onDragOver={(e) => {
                          e.preventDefault()
                          e.dataTransfer.dropEffect = 'move'
                        }}
                        onDrop={(e) => {
                          e.preventDefault()
                          const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'))
                          const targetIndex = index
                          
                          if (draggedIndex !== targetIndex) {
                            const newOrder = [...columnOrder]
                            const [removed] = newOrder.splice(draggedIndex, 1)
                            newOrder.splice(targetIndex, 0, removed)
                            setColumnOrder(newOrder)
                          }
                        }}
                        className={`flex items-center space-x-2 px-3 py-2 rounded cursor-move transition-colors ${
                          isVisible 
                            ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600' 
                            : 'bg-gray-50 dark:bg-gray-800 opacity-50'
                        }`}
                      >
                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {(() => {
                            if (!column) return colId
                            if (typeof column.header === 'string') return column.header
                            if (colId === 'manufacturer') return 'Manufacturer'
                            return colId
                          })()}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </details>
        </div>

        {/* Validation Warning */}
        {invalidSwitches.size > 0 && (
          <div className="mb-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <div className="flex">
              <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  {invalidSwitches.size} switch{invalidSwitches.size !== 1 ? 'es have' : ' has'} invalid manufacturer names
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Invalid entries are highlighted in red. Click on the manufacturer field to see suggestions.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="relative" style={{ height: 'calc(100vh - 400px)' }}>
            <div className="absolute inset-0 overflow-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-20">
                  <tr>
                    {table.getFlatHeaders().map((header, headerIndex) => {
                      const isNameColumn = header.id === 'name'
                      return (
                        <th
                          key={header.id}
                          draggable={!isNameColumn}
                          onDragStart={(e) => {
                            if (isNameColumn) {
                              e.preventDefault()
                              return
                            }
                            e.dataTransfer.effectAllowed = 'move'
                            e.dataTransfer.setData('columnId', header.id)
                            e.currentTarget.classList.add('opacity-50')
                          }}
                          onDragEnd={(e) => {
                            e.currentTarget.classList.remove('opacity-50')
                          }}
                          onDragOver={(e) => {
                            if (isNameColumn) return
                            e.preventDefault()
                            e.dataTransfer.dropEffect = 'move'
                            e.currentTarget.classList.add('bg-gray-200', 'dark:bg-gray-600')
                          }}
                          onDragLeave={(e) => {
                            e.currentTarget.classList.remove('bg-gray-200', 'dark:bg-gray-600')
                          }}
                          onDrop={(e) => {
                            if (isNameColumn) return
                            e.preventDefault()
                            e.currentTarget.classList.remove('bg-gray-200', 'dark:bg-gray-600')
                            
                            const draggedColumnId = e.dataTransfer.getData('columnId')
                            const targetColumnId = header.id
                            
                            if (draggedColumnId !== targetColumnId) {
                              const currentOrder = [...columnOrder]
                              const draggedIndex = currentOrder.indexOf(draggedColumnId)
                              const targetIndex = currentOrder.indexOf(targetColumnId)
                              
                              if (draggedIndex !== -1 && targetIndex !== -1) {
                                const [removed] = currentOrder.splice(draggedIndex, 1)
                                currentOrder.splice(targetIndex, 0, removed)
                                setColumnOrder(currentOrder)
                              }
                            }
                          }}
                          className={`${
                            isNameColumn 
                              ? 'sticky left-0 z-30 bg-gray-50 dark:bg-gray-700 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]' 
                              : 'bg-gray-50 dark:bg-gray-700 cursor-move'
                          } px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider whitespace-nowrap transition-opacity`}
                          style={{ 
                            minWidth: header.column.getSize()
                          }}
                        >
                          <div className="flex items-center space-x-2">
                            {!isNameColumn && (
                              <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                              </svg>
                            )}
                            <span>
                              {flexRender(
                                header.column.columnDef.header,
                                header.getContext()
                              )}
                            </span>
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {table.getRowModel().rows.map(row => (
                  <tr 
                    key={row.id}
                    className={
                      modifiedSwitches.has(row.original.id) 
                        ? 'bg-blue-50 dark:bg-blue-900/20' 
                        : invalidSwitches.has(row.original.id)
                        ? 'bg-red-50 dark:bg-red-900/20'
                        : ''
                    }
                  >
                    {row.getVisibleCells().map(cell => {
                      const isNameColumn = cell.column.id === 'name'
                      const isModified = modifiedSwitches.has(row.original.id)
                      const isInvalid = invalidSwitches.has(row.original.id)
                      
                      return (
                        <td
                          key={cell.id}
                          className={`${
                            isNameColumn 
                              ? `sticky left-0 z-10 ${
                                  isModified 
                                    ? 'bg-blue-50 dark:bg-blue-900/20' 
                                    : isInvalid
                                    ? 'bg-red-50 dark:bg-red-900/20'
                                    : 'bg-white dark:bg-gray-800'
                                } shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]` 
                              : ''
                          } px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100`}
                          style={{ 
                            minWidth: cell.column.getSize()
                          }}
                        >
                          {flexRender(
                            cell.column.columnDef.cell,
                            cell.getContext()
                          )}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

        {/* Instructions */}
        <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
          <p className="font-medium mb-2">Tips:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>Click on any field to edit it directly</li>
            <li>Drag column headers to reorder them (except the Name column which stays fixed)</li>
            <li>Use Column Settings above to show/hide columns or reorder them</li>
            <li>Changes are highlighted in blue</li>
            <li>Invalid manufacturer names are highlighted in red</li>
            <li>Use Tab to move between fields</li>
            <li>Your changes are saved locally until you click &quot;Save All Changes&quot;</li>
          </ul>
        </div>
      </div>
    </div>
  )
}