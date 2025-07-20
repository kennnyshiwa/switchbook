'use client'

import { useState, useEffect } from 'react'
import { findAllSwitchScoreMatches, type SwitchScoreMatch } from '@/utils/switchScores'

interface SwitchScoresButtonProps {
  switchName: string
  manufacturer?: string | null
  variant?: 'button' | 'badge' | 'icon'
  className?: string
}

export default function SwitchScoresButton({ 
  switchName, 
  manufacturer, 
  variant = 'button',
  className = ''
}: SwitchScoresButtonProps) {
  const [matches, setMatches] = useState<SwitchScoreMatch[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let isMounted = true

    async function loadSwitchScoreData() {
      try {
        const foundMatches = await findAllSwitchScoreMatches(switchName, manufacturer || undefined)
        
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

    loadSwitchScoreData()

    return () => {
      isMounted = false
    }
  }, [switchName, manufacturer])

  if (isLoading) {
    return null // Don't show anything while loading
  }

  // If no matches, don't show anything
  if (matches.length === 0) {
    return null
  }

  const handleClick = () => {
    // For now, just open the first (best) match
    // In the future, we could show a dropdown like ForceCurvesButton if there are multiple matches
    if (matches.length > 0) {
      window.open(matches[0].url, '_blank', 'noopener,noreferrer')
    }
  }

  const getTooltip = () => {
    if (matches.length === 1) {
      return "View detailed switch scorecard analysis by ThereminGoat"
    }
    return `${matches.length} switch scorecard options available`
  }

  if (variant === 'badge') {
    return (
      <span 
        onClick={handleClick}
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 cursor-pointer hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors ${className}`}
        title={getTooltip()}
      >
        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        Scorecard
      </span>
    )
  }

  if (variant === 'icon') {
    return (
      <button
        onClick={handleClick}
        className={`text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-colors ${className}`}
        title={getTooltip()}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </button>
    )
  }

  // Default button variant
  return (
    <button
      onClick={handleClick}
      className={`inline-flex items-center px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-100 border border-purple-300 rounded-md hover:bg-purple-200 dark:bg-purple-900 dark:text-purple-200 dark:border-purple-700 dark:hover:bg-purple-800 transition-colors ${className}`}
      title={getTooltip()}
    >
      <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Switch Scorecard
    </button>
  )
}