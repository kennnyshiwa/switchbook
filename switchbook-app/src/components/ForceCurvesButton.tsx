'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import type { ForceCurveMatch } from '@/utils/forceCurves'
import { forceCurvePickerPosition } from '@/lib/force-curve-picker'

type CanonicalCurveMatch = ForceCurveMatch & {
  provenance: string
  condition: string
  measurementDate: string | null
}

interface ForceCurvesButtonProps {
  switchName: string
  masterSwitchId?: string | null
  manufacturer?: string | null
  variant?: 'button' | 'badge' | 'icon'
  className?: string
  isAuthenticated?: boolean
  forceCurvesCached?: boolean
  savedPreference?: { folder: string; url: string }
}

export default function ForceCurvesButton({ 
  switchName, 
  masterSwitchId,
  manufacturer, 
  variant = 'button',
  className = '',
  isAuthenticated = false,
  forceCurvesCached,
  savedPreference: savedPreferenceProp
}: ForceCurvesButtonProps) {
  const [matches, setMatches] = useState<CanonicalCurveMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [savedPreference, setSavedPreference] = useState<{ folder: string; url: string } | null>(null)
  const [showAllOptions, setShowAllOptions] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const pickerId = `force-curve-picker-${masterSwitchId || switchName}`.replace(/[^a-zA-Z0-9_-]/g, '-')

  const positionPicker = () => {
    if (!buttonRef.current) return
    setDropdownStyle(forceCurvePickerPosition(buttonRef.current.getBoundingClientRect(), window.innerWidth, window.innerHeight))
  }

  const displayMeasurementDate = (value: string | null) => value
    ? new Intl.DateTimeFormat(undefined, { timeZone: 'UTC', year: 'numeric', month: 'numeric', day: 'numeric' }).format(new Date(`${value}T00:00:00Z`))
    : 'Date not recorded'

  const canonicalMatch = (curve: { id: string; folderName: string; url: string; provenance?: string; condition?: string; measurementDate?: string | null }): CanonicalCurveMatch => ({
    catalogEntryId: curve.id,
    folderName: curve.folderName,
    url: curve.url,
    matchType: 'exact',
    provenance: curve.provenance || 'Source not specified',
    condition: curve.condition || 'Condition not specified',
    measurementDate: curve.measurementDate || null,
  })

  useEffect(() => {
    let isMounted = true

    async function loadForceCurveData() {
      try {
        let foundMatches: CanonicalCurveMatch[] = []
        if (!masterSwitchId) { if (isMounted) { setMatches([]); setIsLoading(false) }; return }
        const response = await fetch(`/api/force-curves/${encodeURIComponent(masterSwitchId)}`)
        if (response.ok) {
          const data = await response.json()
          foundMatches = data.curves.map(canonicalMatch)
        }
        
        if (isMounted) {
          setMatches(foundMatches)
          
          // Set saved preference from props if provided
          // Legacy display-name URL preferences are retained for rollback, but never opened by canonical reads.
          setSavedPreference(null)
          // Note: We no longer fetch preferences from API since they should be passed as props
          
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
  }, [masterSwitchId, switchName, manufacturer, isAuthenticated, forceCurvesCached, savedPreferenceProp])

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

  const closePicker = useCallback((restoreFocus = true) => {
    setIsDropdownOpen(false)
    if (restoreFocus) requestAnimationFrame(() => buttonRef.current?.focus())
  }, [])

  useEffect(() => {
    if (!isDropdownOpen) return
    pickerRef.current?.querySelector<HTMLButtonElement>('button[data-curve-option], button')?.focus()
  }, [isDropdownOpen])

  useEffect(() => {
    if (!isDropdownOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closePicker() }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isDropdownOpen, closePicker])

  if (isLoading) {
    return null // Don't show anything while loading
  }

  // If no matches and no saved preference, and we know for sure there are no force curves, don't show anything
  if (matches.length === 0 && !savedPreference && forceCurvesCached === false) {
    return null
  }
  
  // If we know there are force curves but haven't loaded matches yet, show the button
  if (matches.length === 0 && !savedPreference && forceCurvesCached !== true) {
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
      setShowAllOptions(false)
    } catch (error) {
      // Failed to save preference, but don't interrupt user flow
    }
  }

  const selectCurve = (folderName: string, url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer')
    closePicker()
    if (isAuthenticated) void savePreference(folderName, url)
  }

  const loadMatchesOnDemand = async () => {
    if (matches.length === 0 && forceCurvesCached === true) {
      // Load actual matches now
      try {
        const response = masterSwitchId ? await fetch(`/api/force-curves/${encodeURIComponent(masterSwitchId)}`) : null
        const data = response?.ok ? await response.json() : { curves: [] }
        const canonicalMatches = data.curves.map(canonicalMatch)
        setMatches(canonicalMatches)
        return canonicalMatches
      } catch (error) {
        // Error loading force curve matches
        return []
      }
    }
    return matches
  }

  const handleClick = async (url?: string) => {
    // If specific URL provided (from dropdown selection), open it
    if (url) {
      window.open(url, '_blank', 'noopener,noreferrer')
      setIsDropdownOpen(false)
      return
    }

    // Load matches if needed
    const currentMatches = await loadMatchesOnDemand()

    // If saved preference exists and not showing all options, show preference options (authenticated users only)
    if (savedPreference && !showAllOptions && isAuthenticated) {
      positionPicker()
      setIsDropdownOpen(!isDropdownOpen)
      return
    }

    // If only one match and no saved preference (or unauthenticated), open it directly
    if (currentMatches.length === 1 && (!savedPreference || !isAuthenticated)) {
      window.open(currentMatches[0].url, '_blank', 'noopener,noreferrer')
      return
    }

    // Otherwise, show a viewport-clamped picker for every trigger variant.
    positionPicker()
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

  const submitFeedback = async (feedbackType: string, incorrectMatch?: string, suggestedMatch?: string, notes?: string) => {
    if (!isAuthenticated) {
      alert('Please log in to submit feedback')
      return
    }

    try {
      const response = await fetch('/api/force-curve-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          switchName,
          masterSwitchId,
          catalogEntryId: matches.find(match => match.folderName === incorrectMatch)?.catalogEntryId,
          manufacturer: manufacturer || null,
          incorrectMatch: incorrectMatch || (savedPreference?.folder) || (matches[0]?.folderName) || 'unknown',
          feedbackType,
          suggestedMatch,
          notes
        })
      })
      
      if (response.ok) {
        setFeedbackSubmitted(true)
        setShowFeedbackForm(false)
        // Optionally reload force curve data to get updated matches
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      } else {
        alert('Failed to submit feedback. Please try again.')
      }
    } catch (error) {
      alert('Failed to submit feedback. Please try again.')
    }
  }

  // Render feedback form
  const renderFeedbackForm = () => (
    <div className="p-3 border-t border-gray-200 dark:border-gray-600">
      <div className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
        Report Issue
      </div>
      <div className="space-y-2">
        <button
          onClick={() => submitFeedback('incorrect_match')}
          className="w-full px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
        >
          This match is wrong
        </button>
        <button
          onClick={() => submitFeedback('no_match_found')}
          className="w-full px-2 py-1 text-xs text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded"
        >
          No force curve should be shown
        </button>
        <button
          onClick={() => setShowFeedbackForm(false)}
          className="w-full px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  )

  // Render dropdown content (shared between positioning methods)
  const renderDropdownContent = () => (
    <div ref={pickerRef} id={pickerId} role="dialog" aria-modal="false" aria-label={`Choose a force curve for ${switchName}`} className="max-h-64 overflow-y-auto">
      {feedbackSubmitted ? (
        <div className="px-3 py-4 text-center">
          <div className="text-green-600 dark:text-green-400 text-sm font-medium">✓ Thank you for your feedback!</div>
          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">Page will refresh shortly...</div>
        </div>
      ) : showFeedbackForm ? (
        renderFeedbackForm()
      ) : savedPreference && !showAllOptions && isAuthenticated ? (
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
            className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-200 dark:border-gray-600 block"
          >
            Choose different option ({matches.length} available)
          </button>
          {isAuthenticated && (
            <button
              onClick={() => setShowFeedbackForm(true)}
              className="w-full px-3 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-b-md block"
            >
              Report incorrect match
            </button>
          )}
        </div>
      ) : (
        <div>
          {savedPreference && isAuthenticated && (
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
              data-curve-option
              onClick={() => selectCurve(match.folderName, match.url)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 block"
            >
              <div className="font-medium text-gray-900 dark:text-white">{match.folderName}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {match.provenance} · {match.condition} · {displayMeasurementDate(match.measurementDate)}
              </div>
            </button>
          ))}
          {matches.length > 0 && isAuthenticated && (
            <button
              onClick={() => setShowFeedbackForm(true)}
              className="w-full px-3 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-b-md block border-t border-gray-200 dark:border-gray-600"
            >
              Report incorrect match
            </button>
          )}
        </div>
      )}
    </div>
  )

  // Render the dropdown (shared across all variants)
  const renderDropdown = () => {
    if (!isDropdownOpen || (matches.length <= 1 && (!savedPreference || !isAuthenticated))) return null

    return (
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg" style={dropdownStyle}>
        {renderDropdownContent()}
      </div>
    )
  }

  if (variant === 'badge') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          ref={buttonRef}
          onClick={() => handleClick()}
          aria-expanded={isDropdownOpen}
          aria-controls={matches.length > 1 ? pickerId : undefined}
          aria-haspopup={matches.length > 1 ? 'dialog' : undefined}
          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors ${className}`}
          title={matches.length === 1 ? "View detailed force curve analysis" : `${matches.length} force curve options available`}
        >
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Force Curves {savedPreference && isAuthenticated ? '✓' : matches.length > 1 ? `(${matches.length})` : ''}
          {(matches.length > 1 || (savedPreference && isAuthenticated)) && (
            <svg className="w-3 h-3 ml-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
        </button>
        {renderDropdown()}
      </div>
    )
  }

  if (variant === 'icon') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          ref={buttonRef}
          onClick={() => handleClick()}
          aria-expanded={isDropdownOpen}
          aria-controls={matches.length > 1 ? pickerId : undefined}
          aria-haspopup={matches.length > 1 ? 'dialog' : undefined}
          aria-label={`View force curves for ${switchName}`}
          className={`text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors ${className}`}
          title={matches.length === 1 ? "View detailed force curve analysis" : `${matches.length} force curve options available`}
        >
          <div className="relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {(matches.length > 1 || (savedPreference && isAuthenticated)) && (
              <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {savedPreference && isAuthenticated ? '✓' : matches.length}
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
        type="button"
        ref={buttonRef}
        onClick={() => handleClick()}
        aria-expanded={isDropdownOpen}
        aria-controls={matches.length > 1 ? pickerId : undefined}
        aria-haspopup={matches.length > 1 ? 'dialog' : undefined}
        aria-label={`View force curves for ${switchName}`}
        className={`inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 border border-purple-300 rounded-md hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700 dark:hover:bg-purple-800 transition-colors ${className}`}
        title={matches.length === 1 ? "View detailed force curve analysis" : `${matches.length} force curve options available`}
      >
        <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        Force Curves {savedPreference && isAuthenticated ? '✓' : matches.length > 1 ? `(${matches.length})` : ''}
        {(matches.length > 1 || (savedPreference && isAuthenticated)) && (
          <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      {renderDropdown()}
    </div>
  )
}
