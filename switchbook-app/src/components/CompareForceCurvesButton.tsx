'use client'

import { useState } from 'react'
import { ChartBarIcon } from '@heroicons/react/24/outline'
import SwitchesDBComparison from './SwitchesDBComparison'

interface CompareForceCurvesButtonProps {
  selectedSwitches: Array<{
    id: string
    name: string
    manufacturer?: string | null
  }>
  disabled?: boolean
}

export default function CompareForceCurvesButton({
  selectedSwitches,
  disabled = false
}: CompareForceCurvesButtonProps) {
  const [showComparison, setShowComparison] = useState(false)

  if (selectedSwitches.length < 2) {
    return null
  }

  return (
    <>
      <button
        onClick={() => setShowComparison(true)}
        disabled={disabled}
        className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChartBarIcon className="h-5 w-5" />
        <span>Compare Force Curves ({selectedSwitches.length})</span>
      </button>

      {showComparison && (
        <SwitchesDBComparison
          selectedSwitches={selectedSwitches}
          onClose={() => setShowComparison(false)}
        />
      )}
    </>
  )
}