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
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let isMounted = true

    async function checkForForceCurves() {
      try {
        const foundMatches = await findAllForceCurveMatches(switchName, manufacturer || undefined)
        if (isMounted) {
          setMatches(foundMatches)
          setIsLoading(false)
        }
      } catch (error) {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    checkForForceCurves()

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

  if (matches.length === 0) {
    return null // No force curve data available
  }

  const handleClick = (url?: string) => {
    if (matches.length === 1 || url) {
      window.open(url || matches[0].url, '_blank', 'noopener,noreferrer')
      setIsDropdownOpen(false)
    } else {
      setIsDropdownOpen(!isDropdownOpen)
    }
  }

  const getMatchTypeLabel = (matchType: ForceCurveMatch['matchType']) => {
    switch (matchType) {
      case 'exact': return 'Exact Match'
      case 'manufacturer-exact': return 'Manufacturer Match'
      case 'fuzzy': return 'Similar'
      case 'manufacturer-fuzzy': return 'Similar (Manufacturer)'
    }
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
          Force Curves {matches.length > 1 && `(${matches.length})`}
          {matches.length > 1 && (
            <svg className="w-3 h-3 ml-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          )}
        </span>
        
        {isDropdownOpen && matches.length > 1 && (
          <div className="absolute bottom-full mb-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-[60] min-w-64 max-w-80">
            {matches.map((match, index) => (
              <button
                key={index}
                onClick={() => handleClick(match.url)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-md last:rounded-b-md border-b border-gray-100 dark:border-gray-700 last:border-b-0"
              >
                <div className="font-medium text-gray-900 dark:text-white truncate">{match.folderName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{getMatchTypeLabel(match.matchType)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (variant === 'icon') {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => handleClick()}
          className={`text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors ${className}`}
          title={matches.length === 1 ? "View detailed force curve analysis" : `${matches.length} force curve options available`}
        >
          <div className="relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            {matches.length > 1 && (
              <span className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                {matches.length}
              </span>
            )}
          </div>
        </button>
        
        {isDropdownOpen && matches.length > 1 && (
          <div className="absolute bottom-full mb-1 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-[60] min-w-64 max-w-80">
            <div className="max-h-64 overflow-y-auto">
              {matches.map((match, index) => (
                <button
                  key={index}
                  onClick={() => handleClick(match.url)}
                  className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-md last:rounded-b-md border-b border-gray-100 dark:border-gray-700 last:border-b-0 block"
                >
                  <div className="font-medium text-gray-900 dark:text-white truncate">{match.folderName}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">{getMatchTypeLabel(match.matchType)}</div>
                </button>
              ))}
            </div>
          </div>
        )}
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
        Force Curves {matches.length > 1 && `(${matches.length})`}
        {matches.length > 1 && (
          <svg className="w-4 h-4 ml-1" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        )}
      </button>
      
      {isDropdownOpen && matches.length > 1 && (
        <div className="absolute bottom-full mb-1 left-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg z-[60] min-w-64 max-w-80">
          <div className="max-h-64 overflow-y-auto">
            {matches.map((match, index) => (
              <button
                key={index}
                onClick={() => handleClick(match.url)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 dark:hover:bg-gray-700 first:rounded-t-md last:rounded-b-md border-b border-gray-100 dark:border-gray-700 last:border-b-0 block"
              >
                <div className="font-medium text-gray-900 dark:text-white truncate">{match.folderName}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{getMatchTypeLabel(match.matchType)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}