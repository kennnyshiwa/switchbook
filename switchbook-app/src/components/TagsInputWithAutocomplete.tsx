'use client'

import { useState, KeyboardEvent, useRef, useEffect } from 'react'

interface TagsInputWithAutocompleteProps {
  tags: string[]
  onChange: (tags: string[]) => void
  placeholder?: string
  suggestions?: string[]
  maxTags?: number
}

export default function TagsInputWithAutocomplete({ 
  tags, 
  onChange, 
  placeholder = "Add a tag...",
  suggestions = [],
  maxTags = 10
}: TagsInputWithAutocompleteProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1)
  const [isSelectingSuggestion, setIsSelectingSuggestion] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Filter suggestions based on input
    if (inputValue.trim()) {
      const filtered = suggestions
        .filter(suggestion => 
          suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
          !tags.includes(suggestion)
        )
        .slice(0, 5) // Limit to 5 suggestions
      setFilteredSuggestions(filtered)
      setShowSuggestions(filtered.length > 0)
    } else {
      setShowSuggestions(false)
      setFilteredSuggestions([])
    }
  }, [inputValue, suggestions, tags])

  // Handle clicks outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current && 
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
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
    if (trimmedValue && !tags.includes(trimmedValue) && tags.length < maxTags) {
      onChange([...tags, trimmedValue])
      setInputValue('')
      setShowSuggestions(false)
      setSelectedSuggestionIndex(-1)
    }
  }

  // Handle blur event to add any pending tag
  const handleBlur = () => {
    // Don't add tag if we're clicking on a suggestion
    setTimeout(() => {
      if (!isSelectingSuggestion && inputValue.trim()) {
        addTag(inputValue)
      }
    }, 150)
  }

  const removeTag = (indexToRemove: number) => {
    onChange(tags.filter((_, index) => index !== indexToRemove))
  }

  const selectSuggestion = (suggestion: string) => {
    setIsSelectingSuggestion(true)
    addTag(suggestion)
    setTimeout(() => {
      setIsSelectingSuggestion(false)
    }, 200)
  }

  return (
    <div className="w-full relative">
      <div className="flex flex-wrap gap-2 p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 min-h-[42px]">
        {tags.map((tag, index) => (
          <span
            key={index}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-gray-200"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(index)}
              className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 focus:outline-none"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          onBlur={handleBlur}
          onFocus={() => {
            if (filteredSuggestions.length > 0) {
              setShowSuggestions(true)
            }
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          className="flex-1 min-w-[120px] bg-transparent border-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 text-sm"
          disabled={tags.length >= maxTags}
        />
      </div>
      
      {showSuggestions && (
        <div
          ref={suggestionsRef}
          className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-48 overflow-auto"
        >
          {filteredSuggestions.map((suggestion, index) => (
            <button
              key={suggestion}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault() // Prevent blur
                selectSuggestion(suggestion)
              }}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-600 ${
                index === selectedSuggestionIndex ? 'bg-gray-100 dark:bg-gray-600' : ''
              }`}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      
      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
        Press Enter or comma to add a tag. Max {maxTags} tags.
      </p>
    </div>
  )
}