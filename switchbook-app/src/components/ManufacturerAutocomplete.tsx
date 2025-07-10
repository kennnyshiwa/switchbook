'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { UseFormRegister, UseFormSetValue } from 'react-hook-form'
import { debounce } from 'lodash'

interface Manufacturer {
  id: string
  name: string
}

interface ManufacturerAutocompleteProps {
  value?: string
  onChange: (value: string) => void
  onNewManufacturerSubmitted?: (name: string) => void
  register?: UseFormRegister<any>
  error?: string
  disabled?: boolean
  placeholder?: string
}

export default function ManufacturerAutocomplete({
  value = '',
  onChange,
  onNewManufacturerSubmitted,
  error,
  disabled = false,
  placeholder = "Type to search manufacturers..."
}: ManufacturerAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value)
  const [suggestions, setSuggestions] = useState<Manufacturer[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)
  const [loading, setLoading] = useState(false)
  const [showNewManufacturer, setShowNewManufacturer] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Update input value when prop changes
  useEffect(() => {
    setInputValue(value)
  }, [value])

  // Debounced search function
  const searchManufacturers = useCallback((query: string) => {
    const debouncedSearch = debounce(async (q: string) => {
      if (!q.trim()) {
        setSuggestions([])
        setShowNewManufacturer(false)
        return
      }

      setLoading(true)
      try {
        const response = await fetch(`/api/manufacturers?q=${encodeURIComponent(q)}`)
        if (response.ok) {
          const data = await response.json()
          setSuggestions(data)
          
          // Show "add new" option if no exact match
          const exactMatch = data.some((m: Manufacturer) => 
            m.name.toLowerCase() === q.toLowerCase()
          )
          setShowNewManufacturer(!exactMatch && q.length > 0)
        }
      } catch (error) {
        // Failed to search manufacturers
      } finally {
        setLoading(false)
      }
    }, 300)
    
    debouncedSearch(query)
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)
    onChange(newValue)
    setShowSuggestions(true)
    setSelectedIndex(-1)
    searchManufacturers(newValue)
  }

  const handleSuggestionClick = (manufacturer: Manufacturer) => {
    setInputValue(manufacturer.name)
    onChange(manufacturer.name)
    setShowSuggestions(false)
    setShowNewManufacturer(false)
  }

  const handleAddNew = async () => {
    if (!inputValue.trim()) return

    setLoading(true)
    try {
      const response = await fetch('/api/manufacturers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: inputValue.trim() })
      })

      if (response.ok) {
        const newManufacturer = await response.json()
        setInputValue(newManufacturer.name)
        onChange(newManufacturer.name)
        setShowSuggestions(false)
        setShowNewManufacturer(false)
        // Notify parent component that a new manufacturer was submitted
        onNewManufacturerSubmitted?.(newManufacturer.name)
      }
    } catch (error) {
      // Failed to add manufacturer
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return

    const totalOptions = suggestions.length + (showNewManufacturer ? 1 : 0)

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(prev => (prev + 1) % totalOptions)
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(prev => (prev - 1 + totalOptions) % totalOptions)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
          handleSuggestionClick(suggestions[selectedIndex])
        } else if (showNewManufacturer && selectedIndex === suggestions.length) {
          handleAddNew()
        }
        break
      case 'Escape':
        setShowSuggestions(false)
        break
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        className={`mt-1 block w-full rounded-md border ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500`}
      />
      
      {error && (
        <p className="mt-1 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {showSuggestions && (suggestions.length > 0 || showNewManufacturer) && (
        <div className="absolute z-10 mt-1 w-full bg-white dark:bg-gray-800 shadow-lg max-h-60 rounded-md py-1 text-base ring-1 ring-black ring-opacity-5 overflow-auto focus:outline-none sm:text-sm">
          {loading && (
            <div className="px-4 py-2 text-gray-500 dark:text-gray-400">
              Searching...
            </div>
          )}
          
          {!loading && suggestions.map((manufacturer, index) => (
            <div
              key={manufacturer.id}
              onClick={() => handleSuggestionClick(manufacturer)}
              className={`cursor-pointer select-none relative py-2 pl-3 pr-9 ${
                index === selectedIndex
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {manufacturer.name}
            </div>
          ))}
          
          {!loading && showNewManufacturer && (
            <div
              onClick={handleAddNew}
              className={`cursor-pointer select-none relative py-2 pl-3 pr-9 border-t border-gray-200 dark:border-gray-700 ${
                selectedIndex === suggestions.length
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <div className="flex items-center">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add &quot;{inputValue}&quot; as new manufacturer
              </div>
              <div className={`text-xs mt-1 ${
                selectedIndex === suggestions.length ? 'text-blue-200' : 'text-gray-500 dark:text-gray-400'
              }`}>
                This will be submitted for review
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}