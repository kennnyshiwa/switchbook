'use client'

import { useState, useEffect, useRef } from 'react'
import { findAllForceCurveMatches, type ForceCurveMatch } from '@/utils/forceCurves'

interface ForceCurvesButtonProps {
  switchName: string
  manufacturer?: string | null
  variant?: 'button' | 'badge' | 'icon'
  className?: string
  isAuthenticated?: boolean
  forceCurvesCached?: boolean
  savedPreference?: { folder: string; url: string }
}

export default function ForceCurvesButton({ 
  switchName, 
  manufacturer, 
  variant = 'button',
  className = '',
  isAuthenticated = false,
  forceCurvesCached,
  savedPreference: savedPreferenceProp
}: ForceCurvesButtonProps) {
  const [matches, setMatches] = useState<ForceCurveMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [savedPreference, setSavedPreference] = useState<{ folder: string; url: string } | null>(null)
  const [showAllOptions, setShowAllOptions] = useState(false)
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})
  const [showFeedbackForm, setShowFeedbackForm] = useState(false)
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let isMounted = true

    async function loadForceCurveData() {
      try {
        let foundMatches: ForceCurveMatch[] = []
        
        // If we already know from the parent component whether this switch has force curves
        if (forceCurvesCached !== undefined) {
          if (forceCurvesCached) {
            // We know it has force curves - we'll load the actual matches when user interacts
            foundMatches = [] // Start empty, will be populated on demand
          } else {
            // We know it doesn't have force curves
            foundMatches = []
          }
        } else {
          // For public/unauthenticated viewing, or when cache is not available,
          // directly check for force curves
          try {
            // First try the cache API endpoint
            const cacheResponse = await fetch(`/api/force-curve-check?switchName=${encodeURIComponent(switchName)}&manufacturer=${encodeURIComponent(manufacturer || '')}`)
            
            if (cacheResponse.ok) {
              const cacheResult = await cacheResponse.json()
              
              if (cacheResult.fromCache) {
                // Use cached result - if cache says it has force curves, we still need to get the actual matches
                // But only call the API if the cache confirms there are force curves
                if (cacheResult.hasForceCurve) {
                  foundMatches = await findAllForceCurveMatches(switchName, manufacturer || undefined)
                } else {
                  foundMatches = []
                }
              } else if (cacheResult.needsCheck) {
                // Cache is missing/expired, defer to batch checking system
                // Don't make individual API calls here, just show no matches for now
                foundMatches = []
              } else {
                // Fallback case
                foundMatches = []
              }
            } else if (cacheResponse.status === 401 || cacheResponse.status === 403) {
              // Unauthorized - this is likely a public page
              // Directly check GitHub for force curves
              foundMatches = await findAllForceCurveMatches(switchName, manufacturer || undefined)
            } else {
              // Other errors - don't make individual API calls
              foundMatches = []
            }
          } catch (cacheError) {
            // If cache check fails, try direct GitHub check for public pages
            try {
              foundMatches = await findAllForceCurveMatches(switchName, manufacturer || undefined)
            } catch (githubError) {
              foundMatches = []
            }
          }
        }
        
        if (isMounted) {
          setMatches(foundMatches)
          
          // Set saved preference from props if provided
          if (savedPreferenceProp) {
            setSavedPreference(savedPreferenceProp)
          }
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
  }, [switchName, manufacturer, isAuthenticated, forceCurvesCached, savedPreferenceProp])

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

  // If no matches and no saved preference, and we know for sure there are no force curves, don't show anything
  if (matches.length === 0 && !savedPreference && forceCurvesCached === false) {
    return null
  }
  
  // If we know there are force curves but haven't loaded matches yet, show the button
  if (matches.length === 0 && !savedPreference && forceCurvesCached !== true) {
    return null
  }

  const savePreference = async (folderName: string, url: string) => {
    // Only allow saving preferences for authenticated users
    if (!isAuthenticated) {
      // For unauthenticated users, just open the URL
      window.open(url, '_blank', 'noopener,noreferrer')
      setIsDropdownOpen(false)
      return
    }
    
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
      // Failed to save preference, but don't interrupt user flow
    }
  }

  const loadMatchesOnDemand = async () => {
    if (matches.length === 0 && forceCurvesCached === true) {
      // Load actual matches now
      try {
        const foundMatches = await findAllForceCurveMatches(switchName, manufacturer || undefined)
        setMatches(foundMatches)
        return foundMatches
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

    // If only one match and no saved preference (or unauthenticated), open it directly
    if (currentMatches.length === 1 && (!savedPreference || !isAuthenticated)) {
      window.open(currentMatches[0].url, '_blank', 'noopener,noreferrer')
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
    <div className="max-h-64 overflow-y-auto">
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
              onClick={() => savePreference(match.folderName, match.url)}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 block"
            >
              <div className="font-medium text-gray-900 dark:text-white truncate">{match.folderName}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{getMatchTypeLabel(match.matchType)}</div>
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
          Force Curves {savedPreference && isAuthenticated ? '✓' : matches.length > 1 ? `(${matches.length})` : ''}
          {(matches.length > 1 || (savedPreference && isAuthenticated)) && (
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
        onClick={() => handleClick()}
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