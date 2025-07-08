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

interface SwitchImage {
  id: string
  url: string
  type: 'UPLOADED' | 'LINKED'
  order: number
  caption?: string | null
  thumbnailUrl?: string
  mediumUrl?: string
}

interface ExtendedSwitch extends Switch {
  images?: SwitchImage[]
}

interface SwitchCollectionProps {
  switches: ExtendedSwitch[]
  userId: string
  showForceCurves: boolean
  forceCurvePreferences: ForceCurvePreference[]
}

export default function SwitchCollection({ switches: initialSwitches, userId, showForceCurves, forceCurvePreferences }: SwitchCollectionProps) {
  const [switches, setSwitches] = useState(initialSwitches)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSwitch, setEditingSwitch] = useState<ExtendedSwitch | null>(null)
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

  const handleSwitchAdded = (newSwitch: ExtendedSwitch) => {
    setSwitches([newSwitch, ...switches])
    setShowAddModal(false)
  }

  const handleSwitchUpdated = (updatedSwitch: ExtendedSwitch) => {
    setSwitches(switches.map(s => s.id === updatedSwitch.id ? updatedSwitch : s))
    // Update the editing switch with new data but keep modal open
    if (editingSwitch && editingSwitch.id === updatedSwitch.id) {
      setEditingSwitch(updatedSwitch)
    }
  }

  const handleSwitchDeleted = (switchId: string) => {
    setSwitches(switches.filter(s => s.id !== switchId))
  }

  // Cache for force curve results to avoid repeated API calls
  const [forceCurveCache, setForceCurveCache] = useState<Map<string, boolean>>(new Map())
  
  // Create a map of force curve preferences for quick lookup
  const forceCurvePreferencesMap = useMemo(() => {
    const map = new Map<string, { folder: string; url: string }>()
    forceCurvePreferences.forEach(pref => {
      const key = `${pref.switchName}|${pref.manufacturer || ''}`
      map.set(key, {
        folder: pref.selectedFolder,
        url: pref.selectedUrl
      })
    })
    return map
  }, [forceCurvePreferences])

  // Track if we've already done the initial batch check
  const [hasCheckedForceCurves, setHasCheckedForceCurves] = useState(false)
  
  // Load existing cache entries and batch check force curves for all switches on mount
  useEffect(() => {
    const checkAllForceCurves = async () => {
      if (switches.length === 0 || hasCheckedForceCurves) return
      
      setHasCheckedForceCurves(true)
      
      try {
        // First, load existing cache entries from database
        const existingCache = await fetch('/api/force-curve-cache').then(res => res.json())
        const cacheMap = new Map<string, boolean>()
        
        if (existingCache && Array.isArray(existingCache)) {
          existingCache.forEach((entry: any) => {
            const key = `${entry.switchName}|${entry.manufacturer || ''}`
            cacheMap.set(key, entry.hasForceCurve)
          })
          console.log(`Loaded ${cacheMap.size} entries from force curve cache`)
        }
        
        // Update local cache with database entries
        setForceCurveCache(prev => new Map([...prev, ...cacheMap]))
        
        // Now check which switches still need to be checked
        const switchesToCheck = switches
          .filter(sw => {
            // Skip if user has saved preferences for this switch
            const hasSavedPreferences = forceCurvePreferences.some(pref => 
              pref.switchName === sw.name && 
              pref.manufacturer === sw.manufacturer
            )
            const key = `${sw.name}|${sw.manufacturer || ''}`
            const inCache = cacheMap.has(key)
            
            return !hasSavedPreferences && !inCache
          })
          .map(sw => ({ name: sw.name, manufacturer: sw.manufacturer || undefined }))
        
        if (switchesToCheck.length > 0) {
          console.log(`Batch checking ${switchesToCheck.length} switches for force curves`)
          
          // Use API endpoint for batch checking
          const response = await fetch('/api/force-curve-batch-check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ switches: switchesToCheck })
          })
          
          if (response.ok) {
            const resultsObject = await response.json()
            const results = new Map(Object.entries(resultsObject).map(([key, value]) => [key, value as boolean]))
            setForceCurveCache(prev => new Map([...prev, ...results]))
          } else {
            console.error('Failed to batch check force curves:', response.statusText)
          }
        } else {
          console.log('All switches already cached, no API calls needed')
        }
      } catch (error) {
        console.error('Error batch checking force curves:', error)
      }
    }
    
    checkAllForceCurves()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
    
    // Check cache first
    const key = `${switchItem.name}|${switchItem.manufacturer || ''}`
    if (forceCurveCache.has(key)) {
      return forceCurveCache.get(key)!
    }
    
    // If not in cache, use API endpoint to check (this should be rare after batch check)
    try {
      const response = await fetch(`/api/force-curve-check?switchName=${encodeURIComponent(switchItem.name)}&manufacturer=${encodeURIComponent(switchItem.manufacturer || '')}`)
      
      if (response.ok) {
        const result = await response.json()
        
        // Update cache with result
        setForceCurveCache(prev => new Map(prev.set(key, result.hasForceCurve)))
        
        return result.hasForceCurve
      } else {
        console.error('Failed to check force curve availability:', response.statusText)
        return false
      }
    } catch (error) {
      console.error('Error checking force curve availability:', error)
      return false
    }
  }, [forceCurvePreferences, forceCurveCache])

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
    const magnetPolarities = [...new Set(switches.map(s => s.magnetPolarity).filter(Boolean) as string[])].sort()
    const pcbThicknesses = [...new Set(switches.map(s => s.pcbThickness).filter(Boolean) as string[])].sort()
    const compatibilities = [...new Set(switches.map(s => s.compatibility).filter(Boolean) as string[])].sort()
    
    // Get unique numeric values for ranges
    const actuationForces = [...new Set(switches.map(s => s.actuationForce).filter(Boolean) as number[])].sort((a, b) => a - b)
    const tactileForces = [...new Set(switches.map(s => s.tactileForce).filter(Boolean) as number[])].sort((a, b) => a - b)
    const bottomOutForces = [...new Set(switches.map(s => s.bottomOutForce).filter(Boolean) as number[])].sort((a, b) => a - b)
    const preTravels = [...new Set(switches.map(s => s.preTravel).filter(Boolean) as number[])].sort((a, b) => a - b)
    const bottomOuts = [...new Set(switches.map(s => s.bottomOut).filter(Boolean) as number[])].sort((a, b) => a - b)
    const initialForces = [...new Set(switches.map(s => s.initialForce).filter(Boolean) as number[])].sort((a, b) => a - b)
    const initialMagneticFluxes = [...new Set(switches.map(s => s.initialMagneticFlux).filter(Boolean) as number[])].sort((a, b) => a - b)
    const bottomOutMagneticFluxes = [...new Set(switches.map(s => s.bottomOutMagneticFlux).filter(Boolean) as number[])].sort((a, b) => a - b)
    
    // Get unique boolean values
    const progressiveSprings = [...new Set(switches.map(s => s.progressiveSpring).filter(b => b !== null && b !== undefined) as boolean[])]
    const doubleStages = [...new Set(switches.map(s => s.doubleStage).filter(b => b !== null && b !== undefined) as boolean[])]

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
      magnetPolarities,
      pcbThicknesses,
      compatibilities,
      actuationForces,
      tactileForces,
      bottomOutForces,
      preTravels,
      bottomOuts,
      initialForces,
      initialMagneticFluxes,
      bottomOutMagneticFluxes,
      progressiveSprings,
      doubleStages
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
          (s.magnetPolarity?.toLowerCase().includes(search) ?? false) ||
          (s.pcbThickness?.toLowerCase().includes(search) ?? false) ||
          (s.compatibility?.toLowerCase().includes(search) ?? false) ||
          (s.personalTags?.some(tag => tag.toLowerCase().includes(search)) ?? false)
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
      if (activeFilters.magnetPolarity) {
        filtered = filtered.filter(s => s.magnetPolarity === activeFilters.magnetPolarity)
      }
      if (activeFilters.pcbThickness) {
        filtered = filtered.filter(s => s.pcbThickness === activeFilters.pcbThickness)
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
      if (activeFilters.tactileForceMin !== undefined) {
        filtered = filtered.filter(s => s.tactileForce !== null && s.tactileForce >= activeFilters.tactileForceMin!)
      }
      if (activeFilters.tactileForceMax !== undefined) {
        filtered = filtered.filter(s => s.tactileForce !== null && s.tactileForce <= activeFilters.tactileForceMax!)
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
      if (activeFilters.initialForceMin !== undefined) {
        filtered = filtered.filter(s => s.initialForce !== null && s.initialForce >= activeFilters.initialForceMin!)
      }
      if (activeFilters.initialForceMax !== undefined) {
        filtered = filtered.filter(s => s.initialForce !== null && s.initialForce <= activeFilters.initialForceMax!)
      }
      if (activeFilters.initialMagneticFluxMin !== undefined) {
        filtered = filtered.filter(s => s.initialMagneticFlux !== null && s.initialMagneticFlux >= activeFilters.initialMagneticFluxMin!)
      }
      if (activeFilters.initialMagneticFluxMax !== undefined) {
        filtered = filtered.filter(s => s.initialMagneticFlux !== null && s.initialMagneticFlux <= activeFilters.initialMagneticFluxMax!)
      }
      if (activeFilters.bottomOutMagneticFluxMin !== undefined) {
        filtered = filtered.filter(s => s.bottomOutMagneticFlux !== null && s.bottomOutMagneticFlux >= activeFilters.bottomOutMagneticFluxMin!)
      }
      if (activeFilters.bottomOutMagneticFluxMax !== undefined) {
        filtered = filtered.filter(s => s.bottomOutMagneticFlux !== null && s.bottomOutMagneticFlux <= activeFilters.bottomOutMagneticFluxMax!)
      }

      // Apply boolean filters
      if (activeFilters.progressiveSpring !== undefined) {
        filtered = filtered.filter(s => s.progressiveSpring === activeFilters.progressiveSpring)
      }
      if (activeFilters.doubleStage !== undefined) {
        filtered = filtered.filter(s => s.doubleStage === activeFilters.doubleStage)
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
          {filteredSwitches.map((switchItem) => {
            const key = `${switchItem.name}|${switchItem.manufacturer || ''}`
            const hasForceCurvesCached = forceCurveCache.get(key) ?? false
            const savedPreference = forceCurvePreferencesMap.get(key)
            return (
              <SwitchCard
                key={switchItem.id}
                switch={switchItem}
                onDelete={handleSwitchDeleted}
                onEdit={setEditingSwitch}
                showForceCurves={showForceCurves}
                forceCurvesCached={hasForceCurvesCached}
                savedPreference={savedPreference}
              />
            )
          })}
        </div>
      ) : (
        <SwitchTable
          switches={filteredSwitches}
          onDelete={handleSwitchDeleted}
          onEdit={setEditingSwitch}
          showForceCurves={showForceCurves}
          forceCurveCache={forceCurveCache}
          forceCurvePreferencesMap={forceCurvePreferencesMap}
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