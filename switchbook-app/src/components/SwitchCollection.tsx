'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Switch, ForceCurvePreference } from '@prisma/client'
import Link from 'next/link'
import SwitchCard from './SwitchCard'
import SwitchTable from './SwitchTable'
import AddSwitchModal from './AddSwitchModal'
import EditSwitchModal from './EditSwitchModal'
import CollectionControls, { SortOption, ViewMode, FilterOptions, ActiveFilters } from './CollectionControls'
import { findForceCurveData } from '@/utils/forceCurves'

interface SwitchCollectionProps {
  switches: Switch[]
  userId: string
  showForceCurves: boolean
  forceCurvePreferences: ForceCurvePreference[]
}

export default function SwitchCollection({ switches: initialSwitches, userId, showForceCurves, forceCurvePreferences }: SwitchCollectionProps) {
  const [switches, setSwitches] = useState(initialSwitches)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSwitch, setEditingSwitch] = useState<Switch | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('recent')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({})

  // Load view mode from localStorage on mount
  useEffect(() => {
    const savedView = localStorage.getItem('switchViewMode')
    if (savedView === 'table' || savedView === 'grid') {
      setViewMode(savedView)
    }
  }, [])

  // Save view mode to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('switchViewMode', viewMode)
  }, [viewMode])

  const handleSwitchAdded = (newSwitch: Switch) => {
    setSwitches([newSwitch, ...switches])
    setShowAddModal(false)
  }

  const handleSwitchUpdated = (updatedSwitch: Switch) => {
    setSwitches(switches.map(s => s.id === updatedSwitch.id ? updatedSwitch : s))
    setEditingSwitch(null)
  }

  const handleSwitchDeleted = (switchId: string) => {
    setSwitches(switches.filter(s => s.id !== switchId))
  }

  // Helper function to check if a switch has force curves
  const switchHasForceCurves = useCallback(async (switchItem: Switch): Promise<boolean> => {
    // First check if user has saved preferences for this switch
    const hasSavedPreferences = forceCurvePreferences.some(pref => 
      pref.switchName === switchItem.name && 
      pref.manufacturer === switchItem.manufacturer
    )
    
    if (hasSavedPreferences) {
      return true
    }
    
    // If no saved preferences, check if force curves are available in the repository
    try {
      const { hasForceCurveData } = await import('@/utils/forceCurves')
      return await hasForceCurveData(switchItem.name, switchItem.manufacturer || undefined)
    } catch (error) {
      console.error('Error checking force curve availability:', error)
      return false
    }
  }, [forceCurvePreferences])

  // Generate filter options from current switches
  const filterOptions = useMemo((): FilterOptions => {
    const manufacturers = [...new Set(switches.map(s => s.manufacturer).filter(Boolean) as string[])].sort()
    const types = [...new Set(switches.map(s => s.type).filter(Boolean) as string[])].sort()
    const technologies = [...new Set(switches.map(s => s.technology).filter(Boolean) as string[])].sort()
    const topHousings = [...new Set(switches.map(s => s.topHousing).filter(Boolean) as string[])].sort()
    const bottomHousings = [...new Set(switches.map(s => s.bottomHousing).filter(Boolean) as string[])].sort()
    const stems = [...new Set(switches.map(s => s.stem).filter(Boolean) as string[])].sort()
    const springWeights = [...new Set(switches.map(s => s.springWeight).filter(Boolean) as string[])].sort()
    const springLengths = [...new Set(switches.map(s => s.springLength).filter(Boolean) as string[])].sort()
    const magnetOrientations = [...new Set(switches.map(s => s.magnetOrientation).filter(Boolean) as string[])].sort()
    const magnetPositions = [...new Set(switches.map(s => s.magnetPosition).filter(Boolean) as string[])].sort()
    const compatibilities = [...new Set(switches.map(s => s.compatibility).filter(Boolean) as string[])].sort()
    
    // Get unique numeric values for ranges
    const actuationForces = [...new Set(switches.map(s => s.actuationForce).filter(Boolean) as number[])].sort((a, b) => a - b)
    const bottomOutForces = [...new Set(switches.map(s => s.bottomOutForce).filter(Boolean) as number[])].sort((a, b) => a - b)
    const preTravels = [...new Set(switches.map(s => s.preTravel).filter(Boolean) as number[])].sort((a, b) => a - b)
    const bottomOuts = [...new Set(switches.map(s => s.bottomOut).filter(Boolean) as number[])].sort((a, b) => a - b)

    return {
      manufacturers,
      types,
      technologies,
      topHousings,
      bottomHousings,
      stems,
      springWeights,
      springLengths,
      magnetOrientations,
      magnetPositions,
      compatibilities,
      actuationForces,
      bottomOutForces,
      preTravels,
      bottomOuts
    }
  }, [switches])

  const [filteredSwitches, setFilteredSwitches] = useState<Switch[]>([])
  const [isFiltering, setIsFiltering] = useState(false)

  // Filter and sort switches (async due to force curve checking)
  useEffect(() => {
    const filterSwitches = async () => {
      setIsFiltering(true)
      let filtered = [...switches]

      // Apply search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        filtered = filtered.filter(s => 
          s.name.toLowerCase().includes(search) ||
          (s.chineseName?.toLowerCase().includes(search) ?? false) ||
          (s.manufacturer?.toLowerCase().includes(search) ?? false) ||
          (s.type?.toLowerCase().includes(search) ?? false) ||
          (s.technology?.toLowerCase().includes(search) ?? false) ||
          (s.notes?.toLowerCase().includes(search) ?? false) ||
          (s.springWeight?.toLowerCase().includes(search) ?? false) ||
          (s.springLength?.toLowerCase().includes(search) ?? false) ||
          (s.topHousing?.toLowerCase().includes(search) ?? false) ||
          (s.bottomHousing?.toLowerCase().includes(search) ?? false) ||
          (s.stem?.toLowerCase().includes(search) ?? false) ||
          (s.magnetOrientation?.toLowerCase().includes(search) ?? false) ||
          (s.magnetPosition?.toLowerCase().includes(search) ?? false) ||
          (s.compatibility?.toLowerCase().includes(search) ?? false)
        )
      }

      // Apply active filters
      if (activeFilters.manufacturer) {
        filtered = filtered.filter(s => s.manufacturer === activeFilters.manufacturer)
      }
      if (activeFilters.type) {
        filtered = filtered.filter(s => s.type === activeFilters.type)
      }
      if (activeFilters.technology) {
        filtered = filtered.filter(s => s.technology === activeFilters.technology)
      }
      if (activeFilters.topHousing) {
        filtered = filtered.filter(s => s.topHousing === activeFilters.topHousing)
      }
      if (activeFilters.bottomHousing) {
        filtered = filtered.filter(s => s.bottomHousing === activeFilters.bottomHousing)
      }
      if (activeFilters.stem) {
        filtered = filtered.filter(s => s.stem === activeFilters.stem)
      }
      if (activeFilters.springWeight) {
        filtered = filtered.filter(s => s.springWeight === activeFilters.springWeight)
      }
      if (activeFilters.springLength) {
        filtered = filtered.filter(s => s.springLength === activeFilters.springLength)
      }
      if (activeFilters.magnetOrientation) {
        filtered = filtered.filter(s => s.magnetOrientation === activeFilters.magnetOrientation)
      }
      if (activeFilters.magnetPosition) {
        filtered = filtered.filter(s => s.magnetPosition === activeFilters.magnetPosition)
      }
      if (activeFilters.compatibility) {
        filtered = filtered.filter(s => s.compatibility === activeFilters.compatibility)
      }

      // Apply numeric range filters
      if (activeFilters.actuationForceMin !== undefined) {
        filtered = filtered.filter(s => s.actuationForce !== null && s.actuationForce >= activeFilters.actuationForceMin!)
      }
      if (activeFilters.actuationForceMax !== undefined) {
        filtered = filtered.filter(s => s.actuationForce !== null && s.actuationForce <= activeFilters.actuationForceMax!)
      }
      if (activeFilters.bottomOutForceMin !== undefined) {
        filtered = filtered.filter(s => s.bottomOutForce !== null && s.bottomOutForce >= activeFilters.bottomOutForceMin!)
      }
      if (activeFilters.bottomOutForceMax !== undefined) {
        filtered = filtered.filter(s => s.bottomOutForce !== null && s.bottomOutForce <= activeFilters.bottomOutForceMax!)
      }
      if (activeFilters.preTravelMin !== undefined) {
        filtered = filtered.filter(s => s.preTravel !== null && s.preTravel >= activeFilters.preTravelMin!)
      }
      if (activeFilters.preTravelMax !== undefined) {
        filtered = filtered.filter(s => s.preTravel !== null && s.preTravel <= activeFilters.preTravelMax!)
      }
      if (activeFilters.bottomOutMin !== undefined) {
        filtered = filtered.filter(s => s.bottomOut !== null && s.bottomOut >= activeFilters.bottomOutMin!)
      }
      if (activeFilters.bottomOutMax !== undefined) {
        filtered = filtered.filter(s => s.bottomOut !== null && s.bottomOut <= activeFilters.bottomOutMax!)
      }

      // Apply force curves filter (async)
      if (activeFilters.hasForceCurves !== undefined) {
        const forceCurveChecks = await Promise.all(
          filtered.map(async (s) => ({
            switch: s,
            hasForceCurves: await switchHasForceCurves(s)
          }))
        )
        
        if (activeFilters.hasForceCurves) {
          // Show only switches that have force curves
          filtered = forceCurveChecks.filter(result => result.hasForceCurves).map(result => result.switch)
        } else {
          // Show only switches that do NOT have force curves
          filtered = forceCurveChecks.filter(result => !result.hasForceCurves).map(result => result.switch)
        }
      }

      // Apply sorting
      const sorted = [...filtered]
      switch (sortOption) {
        case 'recent':
          sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          break
        case 'oldest':
          sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
          break
        case 'name-asc':
          sorted.sort((a, b) => a.name.localeCompare(b.name))
          break
        case 'name-desc':
          sorted.sort((a, b) => b.name.localeCompare(a.name))
          break
        case 'manufacturer-asc':
          sorted.sort((a, b) => (a.manufacturer || 'Unknown').localeCompare(b.manufacturer || 'Unknown'))
          break
        case 'manufacturer-desc':
          sorted.sort((a, b) => (b.manufacturer || 'Unknown').localeCompare(a.manufacturer || 'Unknown'))
          break
        case 'type':
          sorted.sort((a, b) => (a.type || 'No Type').localeCompare(b.type || 'No Type'))
          break
        case 'spring-asc':
          sorted.sort((a, b) => {
            const aWeight = parseFloat(a.springWeight?.match(/\d+/)?.[0] || '0')
            const bWeight = parseFloat(b.springWeight?.match(/\d+/)?.[0] || '0')
            return aWeight - bWeight
          })
          break
        case 'spring-desc':
          sorted.sort((a, b) => {
            const aWeight = parseFloat(a.springWeight?.match(/\d+/)?.[0] || '0')
            const bWeight = parseFloat(b.springWeight?.match(/\d+/)?.[0] || '0')
            return bWeight - aWeight
          })
          break
      }

      setFilteredSwitches(sorted)
      setIsFiltering(false)
    }

    filterSwitches()
  }, [switches, searchTerm, sortOption, activeFilters, switchHasForceCurves])

  if (switches.length === 0) {
    return (
      <>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No switches yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by adding your first switch.</p>
            <div className="mt-6 space-y-3">
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Add your first switch
              </button>
              <div className="text-center">
                <span className="text-gray-400 text-sm">or</span>
              </div>
              <Link
                href="/dashboard/bulk-upload"
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                Bulk Upload
              </Link>
            </div>
          </div>
        </div>
        {showAddModal && (
          <AddSwitchModal
            userId={userId}
            onClose={() => setShowAddModal(false)}
            onSwitchAdded={handleSwitchAdded}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Your Switches ({switches.length}{(searchTerm || Object.values(activeFilters).some(Boolean)) && ` • ${filteredSwitches.length} shown`})
          </h2>
          <div className="flex space-x-3">
            <Link
              href="/dashboard/bulk-upload"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Bulk Upload
            </Link>
            <Link
              href="/dashboard/bulk-edit"
              className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700"
            >
              Bulk Edit
            </Link>
            <button
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
            >
              Add Switch
            </button>
          </div>
        </div>
        <CollectionControls
          onSearchChange={setSearchTerm}
          onSortChange={setSortOption}
          onViewChange={setViewMode}
          onFiltersChange={setActiveFilters}
          currentView={viewMode}
          filterOptions={filterOptions}
        />
      </div>
      
      {isFiltering ? (
        <div className="text-center py-12">
          <p className="text-gray-500">Filtering switches...</p>
        </div>
      ) : filteredSwitches.length === 0 && (searchTerm || Object.values(activeFilters).some(Boolean)) ? (
        <div className="text-center py-12">
          <p className="text-gray-500">
            No switches found matching {searchTerm && `"${searchTerm}"`}
            {searchTerm && Object.values(activeFilters).some(Boolean) && ' with '}
            {Object.values(activeFilters).some(Boolean) && 'the selected filters'}
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSwitches.map((switchItem) => (
            <SwitchCard
              key={switchItem.id}
              switch={switchItem}
              onDelete={handleSwitchDeleted}
              onEdit={setEditingSwitch}
              showForceCurves={showForceCurves}
            />
          ))}
        </div>
      ) : (
        <SwitchTable
          switches={filteredSwitches}
          onDelete={handleSwitchDeleted}
          onEdit={setEditingSwitch}
          showForceCurves={showForceCurves}
        />
      )}

      {showAddModal && (
        <AddSwitchModal
          userId={userId}
          onClose={() => setShowAddModal(false)}
          onSwitchAdded={handleSwitchAdded}
        />
      )}

      {editingSwitch && (
        <EditSwitchModal
          switch={editingSwitch}
          onClose={() => setEditingSwitch(null)}
          onSwitchUpdated={handleSwitchUpdated}
        />
      )}
    </>
  )
}