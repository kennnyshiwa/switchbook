'use client'

import { useState, useEffect } from 'react'
import { findForceCurveData } from '@/utils/forceCurves'

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
  const [forceCurveUrl, setForceCurveUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function checkForForceCurves() {
      try {
        const url = await findForceCurveData(switchName, manufacturer || undefined)
        if (isMounted) {
          setForceCurveUrl(url)
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

  if (isLoading) {
    return null // Don't show anything while loading
  }

  if (!forceCurveUrl) {
    return null // No force curve data available
  }

  const handleClick = () => {
    window.open(forceCurveUrl, '_blank', 'noopener,noreferrer')
  }

  if (variant === 'badge') {
    return (
      <span 
        onClick={handleClick}
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors ${className}`}
        title="View detailed force curve analysis"
      >
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Force Curves
      </span>
    )
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        className={`text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors ${className}`}
        title="View detailed force curve analysis"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      </button>
    )
  }

  // Default button variant
  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 border border-purple-300 rounded-md hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700 dark:hover:bg-purple-800 transition-colors ${className}`}
      title="View detailed force curve analysis"
    >
      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
      Force Curves
    </button>
  )
}