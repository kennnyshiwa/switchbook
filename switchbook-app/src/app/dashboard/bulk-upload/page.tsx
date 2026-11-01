'use client'

import { resolveImportIdentities } from '@/lib/switch-import-identity'
import { useState, useEffect, useRef, useCallback, memo } from 'react'
import { Switch } from '@prisma/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { validateManufacturers, ManufacturerValidationResult } from '@/utils/manufacturerValidation'
import { getMaterials } from '@/utils/materials'
import { getStemShapes } from '@/utils/stemShapes'
import {
  SWITCH_CSV_COLUMNS,
  SwitchCsvData,
  SwitchCsvField,
  QUANTITY_ERROR,
  cleanSpringValue,
  mapSwitchCsvHeaders,
  parseSwitchCsvRow,
  parseCsv,
  switchesToCsv,
} from '@/lib/switchCsv'
import { parseQuantityInput } from '@/lib/validation'

// Field set and value encoding are shared with the CSV export
// (src/lib/switchCsv.ts) so exported collections re-import losslessly.
type ParsedSwitch = SwitchCsvData & { name: string }

interface ColumnMapping {
  [key: string]: SwitchCsvField | null
}

type ImportStep = 'upload' | 'mapping' | 'preview' | 'importing' | 'complete'

interface ParsedSwitchWithDuplicate extends ParsedSwitch {
  isDuplicate?: boolean
  identityMessage?: string
  existingId?: string
  overwrite?: boolean
  importAction?: 'create' | 'overwrite'
  manufacturerValid?: boolean
  manufacturerSuggestions?: string[]
  /** Per-field problems (e.g. an invalid Quantity) that block importing the row. */
  fieldErrors?: Partial<Record<SwitchCsvField, string>>
  /** Raw Quantity text while it is invalid, so the user can see and fix it. */
  quantityInput?: string
}

const hasFieldErrors = (sw: ParsedSwitchWithDuplicate) => Object.keys(sw.fieldErrors ?? {}).length > 0

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
const SwitchTableRow = memo(({ 
  switchItem, 
  index, 
  onUpdate, 
  onToggleOverwrite, 
  onRemove,
  onManufacturerSubmitted,
  isManufacturerSubmitted,
  invalidRowRef,
  materials,
  stemShapes
}: {
  switchItem: ParsedSwitchWithDuplicate
  index: number
  onUpdate: (index: number, field: keyof ParsedSwitchWithDuplicate, value: any) => void
  onToggleOverwrite: (index: number) => void
  onRemove: (index: number) => void
  onManufacturerSubmitted: (name: string) => void
  isManufacturerSubmitted: boolean
  invalidRowRef?: (el: HTMLTableRowElement | null) => void
  materials: { id: string; name: string }[]
  stemShapes: { id: string; name: string }[]
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
    
    onUpdate(index, 'manufacturer', value)
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

  const handleChange = useCallback((field: keyof ParsedSwitchWithDuplicate, value: any) => {
    setLocalValues(prev => ({ ...prev, [field]: value }))
    
    onUpdate(index, field, value)
    
    // If a Franken field is modified and has content, add a visual indicator
    if ((field === 'frankenTop' || field === 'frankenBottom' || field === 'frankenStem') && value && value.trim() !== '') {
      // Add some visual feedback that this is now a Frankenswitch
      console.log(`Frankenswitch detected: ${field} = ${value}`)
    }
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
      className={`${switchItem.isDuplicate ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''} ${(switchItem.manufacturer && !switchItem.manufacturerValid && !isManufacturerSubmitted) || hasFieldErrors(switchItem) ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
    >
      <td className="px-3 py-4 whitespace-nowrap">
        {hasFieldErrors(switchItem) && (
          <div className="mb-1 max-w-[220px] whitespace-normal text-xs text-red-600 dark:text-red-400" role="alert">
            {Object.values(switchItem.fieldErrors ?? {}).map(message => <div key={message}>{message}</div>)}
          </div>
        )}
        {switchItem.isDuplicate ? (
          <div className="flex flex-col space-y-1">
            <span className="max-w-[240px] whitespace-normal text-xs font-medium text-yellow-600 dark:text-yellow-400">
              {switchItem.identityMessage}
            </span>
            <label className="flex items-center text-xs">
              <input
                type="checkbox"
                checked={!!switchItem.overwrite}
                onChange={() => onToggleOverwrite(index)}
                className="mr-1 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-600 dark:text-gray-400">
                {switchItem.existingId ? 'Overwrite owned entry' : 'Create separate entry'}
              </span>
            </label>
          </div>
        ) : (
          <span className="text-xs text-green-600 dark:text-green-400">New</span>
        )}
      </td>
      <td className="px-3 py-4">
        <input
          type="text"
          value={localValues.name}
          onChange={(e) => handleChange('name', e.target.value)}
          className="block w-full min-w-[250px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.chineseName || ''}
          onChange={(e) => handleChange('chineseName', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <select
          value={localValues.type || ''}
          onChange={(e) => handleChange('type', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        >
          <option value="">No type</option>
          <option value="LINEAR">LINEAR</option>
          <option value="TACTILE">TACTILE</option>
          <option value="CLICKY">CLICKY</option>
          <option value="SILENT_LINEAR">SILENT_LINEAR</option>
          <option value="SILENT_TACTILE">SILENT_TACTILE</option>
          <option value="MOUSE">MOUSE</option>
        </select>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <select
          value={localValues.technology || ''}
          onChange={(e) => handleChange('technology', e.target.value)}
          className="block w-full min-w-[180px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        >
          <option value="">No technology</option>
          <option value="MECHANICAL">MECHANICAL</option>
          <option value="OPTICAL">OPTICAL</option>
          <option value="MAGNETIC">MAGNETIC</option>
          <option value="INDUCTIVE">INDUCTIVE</option>
          <option value="ELECTRO_CAPACITIVE">ELECTRO_CAPACITIVE</option>
        </select>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <select
          value={localValues.magnetOrientation || ''}
          onChange={(e) => handleChange('magnetOrientation', e.target.value)}
          className="block w-full min-w-[140px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        >
          <option value="">No orientation</option>
          <option value="Horizontal">Horizontal</option>
          <option value="Vertical">Vertical</option>
        </select>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <select
          value={localValues.magnetPosition || ''}
          onChange={(e) => handleChange('magnetPosition', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        >
          <option value="">No position</option>
          <option value="Center">Center</option>
          <option value="Off-Center">Off-Center</option>
        </select>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.initialForce || ''}
          onChange={(e) => handleChange('initialForce', e.target.value ? parseFloat(e.target.value) : NaN)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          step="any"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.initialMagneticFlux || ''}
          onChange={(e) => handleChange('initialMagneticFlux', e.target.value ? parseFloat(e.target.value) : NaN)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          step="any"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.bottomOutMagneticFlux || ''}
          onChange={(e) => handleChange('bottomOutMagneticFlux', e.target.value ? parseFloat(e.target.value) : NaN)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          step="any"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <select
          value={localValues.pcbThickness || ''}
          onChange={(e) => handleChange('pcbThickness', e.target.value)}
          className="block w-full min-w-[100px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        >
          <option value="">No thickness</option>
          <option value="1.2mm">1.2mm</option>
          <option value="1.6mm">1.6mm</option>
        </select>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <select
          value={localValues.magnetPolarity || ''}
          onChange={(e) => handleChange('magnetPolarity', e.target.value)}
          className="block w-full min-w-[100px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        >
          <option value="">No polarity</option>
          <option value="North">North</option>
          <option value="South">South</option>
        </select>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.compatibility || ''}
          onChange={(e) => handleChange('compatibility', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          placeholder="e.g. MX-style"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
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
            disabled={switchItem.isDuplicate && !switchItem.overwrite}
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
          
          {switchItem.manufacturer && !switchItem.manufacturerValid && !isManufacturerSubmitted && (
            <div className="mt-1">
              <p className="text-xs text-red-600 dark:text-red-400">Invalid manufacturer</p>
              {switchItem.manufacturerSuggestions && switchItem.manufacturerSuggestions.length > 0 && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Did you mean: {switchItem.manufacturerSuggestions.join(', ')}?
                </p>
              )}
            </div>
          )}
          {switchItem.manufacturer && isManufacturerSubmitted && (
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
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.springLength || ''}
          onChange={(e) => handleChange('springLength', e.target.value)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.actuationForce || ''}
          onChange={(e) => handleChange('actuationForce', e.target.value ? parseFloat(e.target.value) : NaN)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.tactileForce || ''}
          onChange={(e) => handleChange('tactileForce', e.target.value ? parseFloat(e.target.value) : NaN)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.tactilePosition || ''}
          onChange={(e) => handleChange('tactilePosition', e.target.value ? parseFloat(e.target.value) : NaN)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={(switchItem.isDuplicate && !switchItem.overwrite) || (localValues.type !== 'TACTILE' && localValues.type !== 'SILENT_TACTILE' && localValues.type !== 'CLICKY')}
          placeholder="0.3, 1.5"
          step="any"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.bottomOutForce || ''}
          onChange={(e) => handleChange('bottomOutForce', e.target.value ? parseFloat(e.target.value) : NaN)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={localValues.progressiveSpring || false}
          onChange={(e) => handleChange('progressiveSpring', e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={localValues.doubleStage || false}
          onChange={(e) => handleChange('doubleStage', e.target.checked)}
          className="h-4 w-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <select
          value={localValues.clickType || ''}
          onChange={(e) => handleChange('clickType', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite || localValues.type !== 'CLICKY'}
        >
          <option value="">No click type</option>
          <option value="CLICK_LEAF">Click Leaf</option>
          <option value="CLICK_BAR">Click Bar</option>
          <option value="CLICK_JACKET">Click Jacket</option>
        </select>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.preTravel || ''}
          onChange={(e) => handleChange('preTravel', e.target.value ? parseFloat(e.target.value) : NaN)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
          step="any"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.bottomOut || ''}
          onChange={(e) => handleChange('bottomOut', e.target.value ? parseFloat(e.target.value) : NaN)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
          step="any"
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <select
          value={localValues.topHousing || ''}
          onChange={(e) => handleChange('topHousing', e.target.value)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        >
          <option value="">Select...</option>
          {materials.map(material => (
            <option key={material.id} value={material.name}>
              {material.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <select
          value={localValues.bottomHousing || ''}
          onChange={(e) => handleChange('bottomHousing', e.target.value)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        >
          <option value="">Select...</option>
          {materials.map(material => (
            <option key={material.id} value={material.name}>
              {material.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <select
          value={localValues.stem || ''}
          onChange={(e) => handleChange('stem', e.target.value)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        >
          <option value="">Select...</option>
          {materials.map(material => (
            <option key={material.id} value={material.name}>
              {material.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.topHousingColor || ''}
          onChange={(e) => handleChange('topHousingColor', e.target.value)}
          className="block w-full min-w-[100px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          placeholder="e.g., Clear"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.bottomHousingColor || ''}
          onChange={(e) => handleChange('bottomHousingColor', e.target.value)}
          className="block w-full min-w-[100px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          placeholder="e.g., Black"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.stemColor || ''}
          onChange={(e) => handleChange('stemColor', e.target.value)}
          className="block w-full min-w-[100px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          placeholder="e.g., Red"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <select
          value={localValues.stemShape || ''}
          onChange={(e) => handleChange('stemShape', e.target.value)}
          className="block w-full min-w-[100px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        >
          <option value="">Select...</option>
          {stemShapes.map(shape => (
            <option key={shape.id} value={shape.name}>
              {shape.name}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.markings || ''}
          onChange={(e) => handleChange('markings', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          placeholder="e.g., Logo on top"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.frankenTop || ''}
          onChange={(e) => handleChange('frankenTop', e.target.value)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.frankenBottom || ''}
          onChange={(e) => handleChange('frankenBottom', e.target.value)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="text"
          value={localValues.frankenStem || ''}
          onChange={(e) => handleChange('frankenStem', e.target.value)}
          className="block w-full min-w-[80px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4">
        <textarea
          value={localValues.notes || ''}
          onChange={(e) => handleChange('notes', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
          rows={2}
        />
      </td>
      <td className="px-3 py-4">
        <textarea
          value={localValues.personalNotes || ''}
          onChange={(e) => handleChange('personalNotes', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
          rows={2}
        />
      </td>
      <td className="px-3 py-4">
        <div className="flex flex-wrap gap-1 min-w-[120px]">
          {(localValues.personalTags || []).map((tag, tagIndex) => (
            <span
              key={tagIndex}
              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-200 text-gray-700 dark:bg-gray-600 dark:text-gray-300"
            >
              {tag}
            </span>
          ))}
        </div>
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="number"
          value={localValues.quantityInput ?? localValues.quantity ?? ''}
          onChange={(e) => {
            // Validated (whole number >= 0) by the parent; invalid text is kept
            // visible and flagged instead of being rounded or dropped.
            const raw = e.target.value
            setLocalValues(prev => ({ ...prev, quantityInput: raw }))
            const existingTimeout = timeoutRefs.current.get('quantity')
            if (existingTimeout) clearTimeout(existingTimeout)
            timeoutRefs.current.set('quantity', setTimeout(() => {
              onUpdate(index, 'quantity', raw)
              timeoutRefs.current.delete('quantity')
            }, 300))
          }}
          aria-invalid={Boolean(switchItem.fieldErrors?.quantity)}
          title={switchItem.fieldErrors?.quantity}
          className={`block w-full min-w-[80px] text-sm rounded-md dark:bg-gray-700 dark:text-white px-3 py-2 ${switchItem.fieldErrors?.quantity ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
          min="0"
          step="1"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <input
          type="date"
          value={localValues.dateObtained || ''}
          onChange={(e) => handleChange('dateObtained', e.target.value)}
          className="block w-full min-w-[120px] text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white px-3 py-2"
          disabled={switchItem.isDuplicate && !switchItem.overwrite}
        />
      </td>
      <td className="px-3 py-4 whitespace-nowrap">
        <button
          onClick={() => onRemove(index)}
          className="text-red-600 hover:text-red-700 text-sm"
        >
          Remove
        </button>
      </td>
    </tr>
  )
})

SwitchTableRow.displayName = 'SwitchTableRow'

export default function BulkUploadPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload')
  const [csvData, setCsvData] = useState<string[][]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({})
  const [parsedRows, setParsedSwitches] = useState<ParsedSwitchWithDuplicate[]>([])
  const [existingSwitches, setExistingSwitches] = useState<Switch[]>([])
  const parsedSwitches = resolveImportIdentities(parsedRows, existingSwitches)
  const [importProgress, setImportProgress] = useState(0)
  const [importResults, setImportResults] = useState<{ success: number; errors: string[]; skipped: number }>({ success: 0, errors: [], skipped: 0 })
  const [manufacturerValidationResults, setManufacturerValidationResults] = useState<Map<string, ManufacturerValidationResult>>(new Map())
  const [isValidating, setIsValidating] = useState(false)
  const [submittedManufacturers, setSubmittedManufacturers] = useState<Set<string>>(new Set())
  const tableRef = useRef<HTMLDivElement>(null)
  const invalidRowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map())
  const [materials, setMaterials] = useState<{ id: string; name: string }[]>([])
  const [stemShapes, setStemShapes] = useState<{ id: string; name: string }[]>([])

  // Fetch materials and stem shapes on component mount
  useEffect(() => {
    getMaterials().then(setMaterials)
    getStemShapes().then(setStemShapes)
  }, [])

  // Handle wheel events to ensure vertical scrolling works
  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      const target = e.target as HTMLElement
      const scrollContainer = target.closest('.overflow-x-auto')
      
      if (scrollContainer && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
        // If scrolling vertically more than horizontally, let the page scroll
        e.preventDefault()
        window.scrollBy(0, e.deltaY)
      }
    }

    const tableContainer = document.querySelector('.overflow-x-auto') as HTMLElement
    if (tableContainer) {
      tableContainer.addEventListener('wheel', handleWheel, { passive: false })
      return () => tableContainer.removeEventListener('wheel', handleWheel as EventListener)
    }
  }, [currentStep])

  const switchFields = SWITCH_CSV_COLUMNS.map(column => ({
    key: column.key,
    label: column.header,
    required: Boolean(column.required),
  }))

  // Fetch existing switches on component mount
  useEffect(() => {
    const fetchExistingSwitches = async () => {
      try {
        const response = await fetch('/api/switches')
        if (response.ok) {
          const switches = await response.json()
          setExistingSwitches(switches)
        }
      } catch (error) {
        console.error('Failed to fetch existing switches:', error)
      }
    }
    fetchExistingSwitches()
  }, [])

  const downloadTemplate = () => {
    const csvContent = switchesToCsv([{
      name: 'Cherry MX Red',
      chineseName: '樱桃红轴',
      type: 'LINEAR',
      technology: 'MECHANICAL',
      compatibility: 'MX-style',
      manufacturer: 'Cherry',
      springWeight: '45g',
      springLength: '11.5mm',
      actuationForce: 45,
      bottomOutForce: 60,
      progressiveSpring: false,
      doubleStage: false,
      preTravel: 2.0,
      bottomOut: 4.0,
      topHousing: 'Nylon',
      bottomHousing: 'Nylon',
      stem: 'POM',
      topHousingColor: 'Black',
      bottomHousingColor: 'Black',
      stemColor: 'Red',
      stemShape: 'MX',
      notes: 'Great for gaming',
      personalNotes: 'Lubed with 205g0',
      personalTags: ['gaming', 'linear'],
      quantity: 90,
      dateObtained: '2024-01-15',
    }])
    
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'switch-template.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      // RFC 4180 parse: quoted fields may contain commas, quotes and newlines.
      let data: string[][]
      try { data = parseCsv(text) } catch (error) { alert(error instanceof Error ? error.message : 'Invalid CSV'); return }
      
      if (data.length > 0) {
        setHeaders(data[0])
        setCsvData(data.slice(1))
        
        // Auto-map columns based on header names
        const autoMapping: ColumnMapping = mapSwitchCsvHeaders(data[0])
        setColumnMapping(autoMapping)
        setCurrentStep('mapping')
      }
    }
    reader.readAsText(file)
  }

  const updateColumnMapping = (columnIndex: string, field: keyof ParsedSwitch | null) => {
    setColumnMapping(prev => ({
      ...prev,
      [columnIndex]: field
    }))
  }

  const parseAndPreview = async () => {
    setIsValidating(true)
    
    const quantityColumn = Object.entries(columnMapping).find(([, field]) => field === 'quantity')?.[0]
    const parsed: ParsedSwitchWithDuplicate[] = csvData.map(row => {
      const { data, errors } = parseSwitchCsvRow(row, columnMapping)
      const parsedRow = { ...data, name: data.name ?? '' } as ParsedSwitchWithDuplicate
      if (!parsedRow.name) errors.name = 'Switch name is required'
      if (Object.keys(errors).length > 0) {
        parsedRow.fieldErrors = errors
        if (errors.quantity && quantityColumn !== undefined) parsedRow.quantityInput = (row[Number(quantityColumn)] ?? '').trim()
      }
      return parsedRow
    }) // Keep invalid rows visible; never silently drop unnamed records.
    
    // Get all manufacturers for validation
    const manufacturers = parsed.map(sw => sw.manufacturer || '').filter(m => m)
    const validationResults = await validateManufacturers(manufacturers)
    setManufacturerValidationResults(validationResults)
    
    // Check for duplicates and add manufacturer validation
    const parsedWithDuplicateCheck = parsed.map(switchItem => {

      
      // Add manufacturer validation results
      let manufacturerValid = true
      let manufacturerSuggestions: string[] = []
      
      if (switchItem.manufacturer) {
        const validationResult = validationResults.get(switchItem.manufacturer)
        if (validationResult) {
          manufacturerValid = true
          manufacturerSuggestions = validationResult.suggestions || []
        }
      }
      
      return {
        ...switchItem,
        manufacturerValid,
        manufacturerSuggestions
      }
    })
    
    setParsedSwitches(parsedWithDuplicateCheck)
    setIsValidating(false)
    setCurrentStep('preview')
    
    // Scroll to first invalid manufacturer after a short delay
    setTimeout(() => {
      const firstInvalidIndex = parsedWithDuplicateCheck.findIndex(sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer))
      if (firstInvalidIndex !== -1) {
        const invalidRow = invalidRowRefs.current.get(firstInvalidIndex)
        if (invalidRow) {
          invalidRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
      }
    }, 100)
  }

  const updateParsedSwitch = useCallback(async (index: number, field: keyof ParsedSwitchWithDuplicate, value: string | number | boolean | string[] | undefined) => {
    // Clean up spring weight and length values when editing
    let cleanedValue = value
    if ((field === 'springWeight' || field === 'springLength') && typeof value === 'string') {
      cleanedValue = cleanSpringValue(value)
    }
    
    // Quantity arrives as the raw input text: accept whole numbers >= 0 (blank
    // clears to null) and flag anything else on the row instead of guessing.
    if (field === 'quantity' && typeof value === 'string') {
      const quantity = parseQuantityInput(value)
      setParsedSwitches(prev => prev.map((sw, i) => {
        if (i !== index) return sw
        const { quantity: _previousError, ...otherErrors } = sw.fieldErrors ?? {}
        return quantity.ok
          ? { ...sw, quantity: quantity.value, quantityInput: undefined, fieldErrors: otherErrors }
          : { ...sw, quantity: undefined, quantityInput: value, fieldErrors: { ...otherErrors, quantity: `${QUANTITY_ERROR} (got "${value.trim()}")` } }
      }))
      return
    }

    setParsedSwitches(prev => prev.map((sw, i) => i !== index ? sw : {
      ...sw, [field]: cleanedValue,
      fieldErrors: Object.fromEntries(Object.entries(sw.fieldErrors ?? {}).filter(([key]) => key !== field)),
      ...(['name', 'manufacturer', 'id'].includes(field) ? { overwrite: false, importAction: undefined } : {}),
      ...(field === 'manufacturer' ? { manufacturerValid: true } : {})
    }))
  }, [])

  const toggleOverwrite = useCallback((index: number) => {
    setParsedSwitches(prev => {
      const resolved = resolveImportIdentities(prev, existingSwitches)[index]
      return prev.map((sw, i) => i !== index ? sw : {
        ...sw, overwrite: !resolved.overwrite,
        importAction: resolved.existingId ? 'overwrite' : 'create'
      })
    })
  }, [existingSwitches])

  const removeParsedSwitch = useCallback((index: number) => {
    setParsedSwitches(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleManufacturerSubmitted = useCallback((name: string) => {
    console.log('New manufacturer submitted:', name)
    setSubmittedManufacturers(prev => new Set(prev).add(name))
  }, [])

  const importSwitches = async () => {
    // Check for invalid manufacturers (excluding submitted ones)
    const invalidManufacturers = parsedSwitches.filter(
      sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer)
    )
    if (invalidManufacturers.length > 0) {
      alert(`Cannot import: ${invalidManufacturers.length} switches have invalid manufacturers. Please fix them or submit for verification.`)
      return
    }
    
    const rowsWithErrors = parsedSwitches.filter(sw => hasFieldErrors(sw) && !(sw.isDuplicate && !sw.overwrite))
    if (rowsWithErrors.length > 0) {
      alert(`Cannot import: ${rowsWithErrors.length} switches have invalid values (highlighted in red). Please fix or remove them.`)
      return
    }
    
    setCurrentStep('importing')
    setImportProgress(0)
    
    const results = { success: 0, errors: [] as string[], skipped: 0 }
    
    for (let i = 0; i < parsedSwitches.length; i++) {
      const switchItem = parsedSwitches[i]
      
      // Skip duplicates that user chose not to overwrite
      if (switchItem.isDuplicate && !switchItem.overwrite) {
        results.skipped++
        setImportProgress(Math.round(((i + 1) / parsedSwitches.length) * 100))
        continue
      }
      
      try {
        let response
        
        if (switchItem.isDuplicate && switchItem.overwrite && switchItem.existingId) {
          // Update existing switch
          const { isDuplicate, existingId, overwrite, importAction, identityMessage, manufacturerValid, manufacturerSuggestions, fieldErrors, quantityInput, ...switchData } = switchItem
          response = await fetch(`/api/switches/${switchItem.existingId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(switchData)
          })
        } else {
          // Create new switch
          const { isDuplicate, existingId, overwrite, importAction, identityMessage, manufacturerValid, manufacturerSuggestions, fieldErrors, quantityInput, ...switchData } = switchItem
          response = await fetch('/api/switches', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(switchData)
          })
          // An exported Master Switch ID may no longer be valid (removed or
          // unapproved master). Keep the row's data rather than failing it.
          if (!response.ok && response.status === 400 && switchData.masterSwitchId) {
            const errorBody = await response.clone().json().catch(() => null)
            if (errorBody?.error === 'Invalid master switch') {
              const { masterSwitchId, masterSwitchVersion, ...unlinkedData } = switchData
              response = await fetch('/api/switches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(unlinkedData)
              })
            }
          }
        }
        
        if (response.ok) {
          results.success++
        } else {
          const error = await response.text()
          console.error(`Failed to save switch ${switchItem.name}:`, error)
          results.errors.push(`Row ${i + 1}: ${error}`)
        }
      } catch (error) {
        results.errors.push(`Row ${i + 1}: Network error`)
      }
      
      setImportProgress(Math.round(((i + 1) / parsedSwitches.length) * 100))
    }
    
    setImportResults(results)
    setCurrentStep('complete')
    if (results.success > 0) router.refresh()
  }

  if (currentStep === 'upload') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <Link href="/dashboard" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center mb-4">
            ← Back to Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Bulk Upload Switches</h1>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">How to Import Switches</h2>
          <div className="space-y-4 text-sm text-gray-600 dark:text-gray-300">
            <p>Follow these steps to bulk import your switch collection:</p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li><strong>Prepare your CSV file</strong> with switch information</li>
              <li><strong>Required field:</strong> Switch Name. Only an owned Collection Switch ID enables overwrite; ambiguous names can be skipped or explicitly created as separate entries.</li>
              <li>Omitted columns and short rows preserve fields. Explicit blank cells clear fields. Image References is a JSON gallery: [] clears it; omission preserves it. References require the media to remain available.</li>
              <li><strong>Optional fields:</strong> Type, Technology, Magnetic Pole Orientation, Magnet Position, Magnet Polarity, Initial Force, Initial Magnetic Flux, Bottom Out Magnetic Flux, PCB Thickness, Compatibility, Chinese Name, Manufacturer, Spring Weight, Spring Length, Progressive Spring, Double Stage, Forces (Actuation, Tactile, Bottom Out), Travel distances, Housing materials, Notes, etc.</li>
              <li><strong>Upload your CSV</strong> and verify the column mapping</li>
              <li><strong>Review and edit</strong> your switches before final import</li>
            </ol>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md mt-4">
              <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2">CSV Format Requirements:</h3>
              <ul className="text-blue-800 dark:text-blue-200 space-y-1">
                <li>• Use commas to separate columns</li>
                <li>• Include headers in the first row</li>
                <li>• Switch Type (if provided) must be: LINEAR, TACTILE, CLICKY, SILENT_LINEAR, SILENT_TACTILE, or MOUSE (case-insensitive)</li>
                <li>• Technology (if provided) must be: MECHANICAL, OPTICAL, MAGNETIC, INDUCTIVE, or ELECTRO_CAPACITIVE (case-insensitive)</li>
                <li>• Magnetic Pole Orientation (if provided) must be: Horizontal or Vertical (case-insensitive)</li>
                <li>• Magnet Position (if provided) must be: Center or Off-Center (case-insensitive)</li>
                <li>• Initial Force should be a numeric value in grams (e.g., 35, 55)</li>
                <li>• Initial Magnetic Flux should be a numeric value in Gauss (e.g., 1200, 1500)</li>
                <li>• Bottom Out Magnetic Flux should be a numeric value in Gauss (e.g., 3000, 3500)</li>
                <li>• PCB Thickness (if provided) must be: 1.2mm or 1.6mm</li>
                <li>• Magnet Polarity (if provided) must be: North or South (case-insensitive)</li>
                <li>• Compatibility is a free text field (e.g., &quot;MX-style&quot;, &quot;Cherry MX&quot;, &quot;3-pin&quot;, &quot;5-pin&quot;)</li>
                <li>• Manufacturer names will be verified during import - use standard names like &quot;Gateron&quot;, &quot;Cherry&quot;, &quot;Kailh&quot;</li>
                <li>• Franken Top, Franken Bottom, Franken Stem are free text fields for custom switch modifications</li>
                <li>• Forces should be numeric values in grams (Actuation, Bottom Out, and Tactile for tactile switches)</li>
                <li>• Tactile Force is only applicable for TACTILE, SILENT_TACTILE, and CLICKY switch types</li>
                <li>• Tactile Position is only applicable for TACTILE, SILENT_TACTILE, and CLICKY switch types, numeric value in mm (e.g., 0.3, 1.5)</li>
                <li>• Click Type is only applicable for CLICKY switches and must be: CLICK_LEAF, CLICK_BAR, or CLICK_JACKET (case-insensitive)</li>
                <li>• Progressive Spring and Double Stage should be &quot;true&quot;/&quot;false&quot;, &quot;yes&quot;/&quot;no&quot;, or &quot;1&quot;/&quot;0&quot;</li>
                <li>• Travel distances should be numeric values in millimeters</li>
                <li>• Quantity (if provided) must be a whole number of 0 or more</li>
                <li>• Personal Tags can be a JSON list (e.g., [&quot;gaming&quot;,&quot;lubed&quot;]) or comma-separated (e.g., gaming, lubed)</li>
                <li>• Values containing commas, quotes or line breaks must be wrapped in double quotes, with inner quotes doubled</li>
                <li>• A file exported from Account Settings can be re-imported as-is</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Upload Your CSV File</h2>
            <button
              onClick={downloadTemplate}
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline"
            >
              Download Template CSV
            </button>
          </div>
          
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="hidden"
              id="csv-upload"
            />
            <label
              htmlFor="csv-upload"
              className="cursor-pointer inline-flex items-center px-6 py-3 border border-transparent shadow-sm text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Choose CSV File
            </label>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Select a CSV file to upload your switches</p>
          </div>
        </div>
        </div>
      </div>
    )
  }

  if (currentStep === 'mapping') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Map CSV Columns</h1>
          <p className="text-gray-600 dark:text-gray-300">Verify that each column maps to the correct switch field</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {headers.map((header, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Column: &quot;{header}&quot;
                    </label>
                  </div>
                  <div className="flex-1">
                    <select
                      value={columnMapping[index.toString()] || ''}
                      onChange={(e) => updateColumnMapping(index.toString(), e.target.value as keyof ParsedSwitch || null)}
                      className="block w-full rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    >
                      <option value="">Skip this column</option>
                      {switchFields.map(field => (
                        <option key={field.key} value={field.key}>
                          {field.label} {field.required ? '(Required)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700 flex justify-between">
            <button
              onClick={() => setCurrentStep('upload')}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              ← Back
            </button>
            <button
              onClick={parseAndPreview}
              disabled={isValidating}
              className={`px-6 py-2 rounded-md ${
                isValidating
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              {isValidating ? 'Validating...' : 'Continue to Preview'}
            </button>
          </div>
        </div>
        </div>
      </div>
    )
  }

  if (currentStep === 'preview') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="p-6">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Preview & Edit Switches</h1>
              <p className="text-gray-600 dark:text-gray-300">
                Review your {parsedSwitches.length} switches before importing
              </p>
            </div>
            <button
              onClick={() => {
                if (confirm('Are you sure you want to go back? Any edits you\'ve made will be lost.')) {
                  setCurrentStep('upload')
                  setCsvData([])
                  setHeaders([])
                  setColumnMapping({})
                  setParsedSwitches([])
                }
              }}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Re-upload CSV
            </button>
          </div>
          {parsedSwitches.some(sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer)) && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">
                ⚠️ Some switches have invalid manufacturers. Please fix them before importing.
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                Invalid manufacturers are highlighted in red. Use the autocomplete to select valid manufacturers or submit new ones.
              </p>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          <div className="overflow-x-auto" style={{ overscrollBehavior: 'none' }}>
            <table className="min-w-full table-auto divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
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
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Magnetic Pole Orientation
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Magnet Position
                  </th>
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
                    PCB Thickness
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Magnet Polarity
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Compatibility
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
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
                        <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-56 p-2 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg z-10 normal-case">
                          If you don&apos;t know the manufacturer, you can enter &quot;Unknown&quot; in this field.
                          <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></span>
                        </span>
                      </span>
                    </span>
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
                    Tactile Force (g)
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tactile Position (mm)
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Bottom Out Force (g)
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Progressive Spring
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Double Stage
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Click Type
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
                    Top Housing Color
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Bottom Housing Color
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Stem Color
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Stem Shape
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Markings
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Franken Top
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Franken Bottom
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Franken Stem
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Notes
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Personal Notes
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Personal Tags
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Quantity
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date Obtained
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700 relative">
                {parsedSwitches.map((switchItem, index) => (
                  <SwitchTableRow
                    key={index}
                    switchItem={switchItem}
                    index={index}
                    onUpdate={updateParsedSwitch}
                    onToggleOverwrite={toggleOverwrite}
                    onRemove={removeParsedSwitch}
                    onManufacturerSubmitted={handleManufacturerSubmitted}
                    isManufacturerSubmitted={switchItem.manufacturer ? submittedManufacturers.has(switchItem.manufacturer) : false}
                    materials={materials}
                    stemShapes={stemShapes}
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
            <button
              onClick={() => setCurrentStep('mapping')}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
            >
              ← Back to Mapping
            </button>
            <button
              onClick={importSwitches}
              disabled={parsedSwitches.some(sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer))}
              className={`px-6 py-2 rounded-md ${
                parsedSwitches.some(sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer))
                  ? 'bg-gray-400 text-gray-200 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              {parsedSwitches.some(sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer)) ? (
                `Fix ${parsedSwitches.filter(sw => sw.manufacturer && !sw.manufacturerValid && !submittedManufacturers.has(sw.manufacturer)).length} Invalid Manufacturers`
              ) : (
                `Import ${parsedSwitches.filter(s => !s.isDuplicate || s.overwrite).length} of ${parsedSwitches.length} Switches`
              )}
            </button>
          </div>
        </div>
        </div>
      </div>
    )
  }

  if (currentStep === 'importing') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Importing Switches...</h1>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4 mb-4">
            <div 
              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${importProgress}%` }}
            ></div>
          </div>
          <p className="text-gray-600 dark:text-gray-300">{importProgress}% complete</p>
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Import Complete!</h1>
          
          <div className="space-y-4">
            <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-md">
              <h3 className="font-medium text-green-900 dark:text-green-100">
                Successfully imported {importResults.success} switches
              </h3>
            </div>
            
            {importResults.skipped > 0 && (
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-md">
                <h3 className="font-medium text-blue-900 dark:text-blue-100">
                  Skipped {importResults.skipped} duplicate switches
                </h3>
              </div>
            )}
            
            {importResults.errors.length > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-md">
                <h3 className="font-medium text-red-900 dark:text-red-100 mb-2">
                  {importResults.errors.length} errors occurred:
                </h3>
                <ul className="text-sm text-red-800 dark:text-red-200 space-y-1">
                  {importResults.errors.map((error, index) => (
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
                setCurrentStep('upload')
                setCsvData([])
                setHeaders([])
                setColumnMapping({})
                setParsedSwitches([])
                setImportProgress(0)
                setImportResults({ success: 0, errors: [], skipped: 0 })
              }}
              className="flex-1 px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Import More
            </button>
          </div>
        </div>
        </div>
      </div>
    )
  }

  return null
}
