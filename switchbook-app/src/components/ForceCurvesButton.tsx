'use client'

import { useState, useEffect, useRef } from 'react'
import { findAllForceCurveMatches, type ForceCurveMatch } from '@/utils/forceCurves'

interface ForceCurvesButtonProps {
  switchName: string
  manufacturer?: string | null
  variant?: 'button' | 'badge' | 'icon'
  className?: string
}

export default function ForceCurvesButton({ 
  switchName, 
  manufacturer, 
  variant = 'button',
  className = ''
}: ForceCurvesButtonProps) {
  const [matches, setMatches] = useState<ForceCurveMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [savedPreference, setSavedPreference] = useState<{ folder: string; url: string } | null>(null)
  const [showAllOptions, setShowAllOptions] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let isMounted = true

    async function loadForceCurveData() {
      try {
        // Load matches and preferences in parallel
        const [foundMatches, preferenceResponse] = await Promise.all([
          findAllForceCurveMatches(switchName, manufacturer || undefined),
          fetch(`/api/force-curve-preferences?switchName=${encodeURIComponent(switchName)}&manufacturer=${encodeURIComponent(manufacturer || '')}`).catch(() => null)
        ])

        if (isMounted) {
          setMatches(foundMatches)
          
          // Check for saved preference
          if (preferenceResponse?.ok) {
            const preference = await preferenceResponse.json()
            if (preference?.selectedFolder) {
              setSavedPreference({
                folder: preference.selectedFolder,
                url: preference.selectedUrl
              })
            }
          }
          
          setIsLoading(false)
        }
      } catch (error) {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadForceCurveData()

    return () => {
      isMounted = false
    }
  }, [switchName, manufacturer])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  if (isLoading) {
    return null // Don't show anything while loading
  }

  // If no matches and no saved preference, don't show anything
  if (matches.length === 0 && !savedPreference) {
    return null
  }

  const savePreference = async (folderName: string, url: string) => {
    try {
      const response = await fetch('/api/force-curve-preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          switchName,
          manufacturer: manufacturer || null,
          selectedFolder: folderName,
          selectedUrl: url
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(`HTTP error! status: ${response.status}, details: ${JSON.stringify(errorData)}`)
      }
      
      setSavedPreference({ folder: folderName, url })
      setIsDropdownOpen(false)
      setShowAllOptions(false)
    } catch (error) {
      console.error('Failed to save preference:', error)
    }
  }

  const handleClick = (url?: string) => {
    // If specific URL provided (from dropdown selection), open it
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
      setIsDropdownOpen(false)
      return
    }

    // If saved preference exists and not showing all options, show preference options
    if (savedPreference && !showAllOptions) {
      // Calculate position for icon variant to escape table
      if (variant === 'icon' && buttonRef.current) {
        const rect = buttonRef.current.getBoundingClientRect()
        setDropdownStyle({
          position: 'fixed',
          top: rect.top - 4, // position just above button (will grow upward with bottom-full)
          right: window.innerWidth - rect.right, // anchor to right edge of button
          zIndex: 9999
        })
      }
      setIsDropdownOpen(!isDropdownOpen)
      return
    }

    // If only one match and no saved preference, open it directly
    if (matches.length === 1 && !savedPreference) {
      window.open(matches[0].url, '_blank', 'noopener,noreferrer')
      return
    }

    // Otherwise, show dropdown with options
    // Calculate position for icon variant to escape table
    if (variant === 'icon' && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setDropdownStyle({
        position: 'fixed',
        top: rect.top - 4, // position just above button (will grow upward with bottom-full)
        right: window.innerWidth - rect.right, // anchor to right edge of button
        zIndex: 9999
      })
    }
    setIsDropdownOpen(!isDropdownOpen)
  }

  const getMatchTypeLabel = (matchType: ForceCurveMatch['matchType']) => {
    switch (matchType) {
      case 'exact': return 'Exact Match'
      case 'manufacturer-exact': return 'Manufacturer Match'
      case 'fuzzy': return 'Similar'
      case 'manufacturer-fuzzy': return 'Similar (Manufacturer)'
    }
  }

  // Render dropdown content (shared between positioning methods)
  const renderDropdownContent = () => (
    <div className="max-h-64 overflow-y-auto">
      {savedPreference && !showAllOptions ? (
        <div>
          <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-600">
            <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">Selected</div>
            <div className="font-medium text-gray-900 dark:text-white truncate">{savedPreference.folder}</div>
          </div>
          <button
            onClick={() => {
              window.open(savedPreference.url, '_blank', 'noopener,noreferrer')
              setIsDropdownOpen(false)
            }}
            className="w-full px-3 py-2 text-left text-sm text-green-600 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 block"
          >
            Open this force curve
          </button>
          <button
            onClick={() => setShowAllOptions(true)}
            className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-b-md block"
          >
            Choose different option ({matches.length} available)
          </button>
        </div>
      ) : (
        <div>
          {savedPreference && (
            <button
              onClick={() => setShowAllOptions(false)}
              className="w-full px-3 py-2 text-left text-sm text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600"
            >
              ← Back to selected: {savedPreference.folder}
            </button>
          )}
          {matches.map((match, index) => (
            <button
              key={index}
              onClick={() => savePreference(match.folderName, match.url)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 last:rounded-b-md border-b border-gray-100 dark:border-gray-700 last:border-b-0 block"
            >
              <div className="font-medium text-gray-900 dark:text-white truncate">{match.folderName}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{getMatchTypeLabel(match.matchType)}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )

  // Render the dropdown (shared across all variants)
  const renderDropdown = () => {
    if (!isDropdownOpen || (matches.length <= 1 && !savedPreference)) return null

    // For icon variant, use fixed positioning to escape table
    if (variant === 'icon') {
      return (
        <div 
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg w-80"
          style={{
            ...dropdownStyle,
            transform: 'translateY(-100%)', // Make it grow upward from the anchor point
            marginBottom: '4px' // Add small gap like mb-1
          }}
        >
          {renderDropdownContent()}
        </div>
      )
    }

    // For other variants, use normal absolute positioning
    return (
      <div className="absolute bottom-full mb-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-[9999] w-80">
        {renderDropdownContent()}
      </div>
    )
  }

  if (variant === 'badge') {
    return (
      <div className="relative" ref={dropdownRef}>
        <span 
          onClick={() => handleClick()}
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors ${className}`}
          title={matches.length === 1 ? "View detailed force curve analysis" : `${matches.length} force curve options available`}
        >
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Force Curves {savedPreference ? '✓' : matches.length > 1 ? `(${matches.length})` : ''}
          {(matches.length > 1 || savedPreference) && (
            <svg className="w-3 h-3 ml-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
        </span>
        {renderDropdown()}
      </div>
    )
  }

  if (variant === 'icon') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          ref={buttonRef}
          onClick={() => handleClick()}
          className={`text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors ${className}`}
          title={matches.length === 1 ? "View detailed force curve analysis" : `${matches.length} force curve options available`}
        >
          <div className="relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {(matches.length > 1 || savedPreference) && (
              <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {savedPreference ? '✓' : matches.length}
              </span>
            )}
          </div>
        </button>
        {renderDropdown()}
      </div>
    )
  }

  // Default button variant
  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => handleClick()}
        className={`inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 border border-purple-300 rounded-md hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700 dark:hover:bg-purple-800 transition-colors ${className}`}
        title={matches.length === 1 ? "View detailed force curve analysis" : `${matches.length} force curve options available`}
      >
        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Force Curves {savedPreference ? '✓' : matches.length > 1 ? `(${matches.length})` : ''}
        {(matches.length > 1 || savedPreference) && (
          <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      {renderDropdown()}
    </div>
  )
}