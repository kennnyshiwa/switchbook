'use client'

import { useState, useEffect } from 'react'
import { Switch } from '@prisma/client'

interface LinkToCollectionDialogProps {
  masterSwitchId: string
  masterSwitchName: string
  onClose: () => void
  onSuccess: () => void
}

export default function LinkToCollectionDialog({
  masterSwitchId,
  masterSwitchName,
  onClose,
  onSuccess
}: LinkToCollectionDialogProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [userSwitches, setUserSwitches] = useState<Switch[]>([])
  const [filteredSwitches, setFilteredSwitches] = useState<Switch[]>([])
  const [selectedSwitchId, setSelectedSwitchId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLinking, setIsLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch user's switches
  useEffect(() => {
    const fetchSwitches = async () => {
      try {
        const response = await fetch('/api/switches')
        if (response.ok) {
          const data = await response.json()
          // Filter out switches that are already linked to a master switch
          const unlinkedSwitches = data.switches.filter((sw: Switch) => !sw.masterSwitchId)
          setUserSwitches(unlinkedSwitches)
          setFilteredSwitches(unlinkedSwitches)
        }
      } catch (error) {
        console.error('Failed to fetch switches:', error)
        setError('Failed to load your switches')
      } finally {
        setIsLoading(false)
      }
    }

    fetchSwitches()
  }, [])

  // Filter switches based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSwitches(userSwitches)
    } else {
      const query = searchQuery.toLowerCase()
      const filtered = userSwitches.filter(sw => 
        sw.name.toLowerCase().includes(query) ||
        sw.manufacturer?.toLowerCase().includes(query) ||
        sw.notes?.toLowerCase().includes(query)
      )
      setFilteredSwitches(filtered)
    }
  }, [searchQuery, userSwitches])

  const handleLink = async () => {
    if (!selectedSwitchId) return

    setIsLinking(true)
    setError(null)

    try {
      const response = await fetch(`/api/master-switches/${masterSwitchId}/link-existing`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userSwitchId: selectedSwitchId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to link switch')
      }

      onSuccess()
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to link switch')
    } finally {
      setIsLinking(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
            Link to Collection
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Select a switch from your collection to link to &quot;{masterSwitchName}&quot;
          </p>
        </div>
        
        <div className="p-6 flex-1 overflow-y-auto">
          {error && (
            <div className="mb-4 rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          <div className="mb-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md p-4 mb-4">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Warning:</strong> Linking will override all details of your switch with the master switch data. 
                Your personal notes will be preserved and any existing notes will be moved to personal notes.
              </p>
            </div>

            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your switches..."
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">Loading your switches...</p>
            </div>
          ) : filteredSwitches.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                {userSwitches.length === 0 
                  ? "You don't have any switches that can be linked."
                  : "No switches found matching your search."}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredSwitches.map((sw) => (
                <label
                  key={sw.id}
                  className={`block p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedSwitchId === sw.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <input
                    type="radio"
                    name="switch"
                    value={sw.id}
                    checked={selectedSwitchId === sw.id}
                    onChange={(e) => setSelectedSwitchId(e.target.value)}
                    className="sr-only"
                  />
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {sw.name}
                        </h4>
                        {sw.manufacturer && (
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {sw.manufacturer}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {sw.type && <span className="capitalize">{sw.type.replace('_', ' ').toLowerCase()}</span>}
                      </div>
                    </div>
                    {sw.notes && (
                      <p className="mt-2 text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
                        {sw.notes}
                      </p>
                    )}
                    {sw.dateObtained && (
                      <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Obtained: {new Date(sw.dateObtained).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleLink}
            disabled={!selectedSwitchId || isLinking}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-transparent rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
          >
            {isLinking ? 'Linking...' : 'Link Switch'}
          </button>
        </div>
      </div>
    </div>
  )
}