'use client'

import { useEffect, useState } from 'react'
import { XMarkIcon } from '@heroicons/react/24/outline'

interface SwitchesDBComparisonProps {
  selectedSwitches: Array<{
    id: string
    name: string
    manufacturer?: string | null
  }>
  onClose: () => void
}

export default function SwitchesDBComparison({ selectedSwitches, onClose }: SwitchesDBComparisonProps) {
  const [iframeUrl, setIframeUrl] = useState<string>('')
  const [isLoading, setIsLoading] = useState(true)
  const [switchSources, setSwitchSources] = useState<{ [key: string]: string }>({})

  useEffect(() => {
    // Initialize sources for each switch with intelligent defaults
    const defaultSources: { [key: string]: string } = {}
    selectedSwitches.forEach(sw => {
      // Some switches are known to be in specific sources
      const switchNameLower = sw.name.toLowerCase()

      // Check for known patterns
      if (switchNameLower.includes('alps') || switchNameLower.includes('skcm')) {
        // Alps switches are typically in Haata
        defaultSources[sw.id] = 'HT'
      } else if (switchNameLower.includes('topre') || switchNameLower.includes('bke') ||
                 switchNameLower.includes('niz') || switchNameLower.includes('dynacaps')) {
        // Topre/Topre-clone switches are in BuddyOG
        defaultSources[sw.id] = 'BO'
      } else {
        // Default to ThereminGoat as it has the most comprehensive collection
        defaultSources[sw.id] = 'TG'
      }
    })
    setSwitchSources(defaultSources)
  }, [selectedSwitches])

  useEffect(() => {
    // Generate the SwitchesDB URL from selected switches
    const switches = selectedSwitches

    if (switches.length === 0) {
      setIsLoading(false)
      return
    }

    // Build the hash fragment for SwitchesDB
    // Each switch uses its selected source
    const switchParams = switches
      .map(sw => {
        const cleanName = sw.name.replace(/\s+/g, '%20')
        const source = switchSources[sw.id] || 'TG'
        return `${cleanName}~${source}.csv`
      })
      .join(',')

    // Use subdomain for SwitchesDB to avoid iframe issues
    const baseUrl = 'https://switchesdb.switchbook.app/'
    const url = `${baseUrl}#${switchParams}`
    console.log('Generated URL:', url)

    setIframeUrl(url)
    setIsLoading(false)
  }, [selectedSwitches, switchSources])

  const handleSourceChange = (switchId: string, source: string) => {
    setSwitchSources(prev => ({
      ...prev,
      [switchId]: source
    }))
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-7xl h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Force Curve Comparison
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Powered by SwitchesDB with updated force curve data
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500 dark:hover:text-gray-300"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Source selector for each switch */}
          <div className="flex flex-wrap gap-2 mt-3">
            {selectedSwitches.map(sw => (
              <div key={sw.id} className="text-xs bg-gray-100 dark:bg-gray-700 rounded px-2 py-1 flex items-center gap-1">
                <span className="text-gray-700 dark:text-gray-300">{sw.name}:</span>
                <select
                  value={switchSources[sw.id] || 'TG'}
                  onChange={(e) => handleSourceChange(sw.id, e.target.value)}
                  className="bg-white dark:bg-gray-800 border-0 text-gray-900 dark:text-white focus:ring-0 text-xs cursor-pointer rounded px-1"
                >
                  <option value="TG" className="bg-white dark:bg-gray-800">ThereminGoat</option>
                  <option value="HT" className="bg-white dark:bg-gray-800">Haata</option>
                  <option value="BP" className="bg-white dark:bg-gray-800">BluePylons</option>
                  <option value="BO" className="bg-white dark:bg-gray-800">BuddyOG (Topre)</option>
                </select>
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 relative">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-500 dark:text-gray-400">
                Loading force curve comparison...
              </div>
            </div>
          ) : iframeUrl ? (
            <>
              <iframe
                src={iframeUrl}
                className="w-full h-full border-0"
                title="SwitchesDB Force Curve Comparison"
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              />
              {/* Show the URL for debugging/reference */}
              <div className="absolute bottom-4 left-4 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
                <a
                  href={iframeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  Open in new tab ↗
                </a>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <p>No switches selected for comparison</p>
              <p className="text-sm mt-2">Select switches from your collection to compare force curves</p>
            </div>
          )}
        </div>

        {/* Footer with tips */}
        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <div className="text-xs text-gray-600 dark:text-gray-400">
            <strong>Tip:</strong> The graph shows force-distance curves from ThereminGoat, Haata, BluePylons, and BuddyOG (Topre) databases.
            Use the controls in the graph to zoom, pan, and toggle different curves.
          </div>
        </div>
      </div>
    </div>
  )
}