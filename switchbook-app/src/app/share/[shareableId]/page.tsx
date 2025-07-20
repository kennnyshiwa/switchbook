'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { Switch, ForceCurvePreference } from '@prisma/client'
import Image from 'next/image'
import CollectionStats from '@/components/CollectionStats'
import SwitchCard from '@/components/SwitchCard'
import SwitchTable from '@/components/SwitchTable'
import CollectionControls, { SortOption, ViewMode, FilterOptions, ActiveFilters } from '@/components/CollectionControls'
import { SWITCH_TYPE_COLORS, SWITCH_TECHNOLOGY_COLORS } from '@/constants/switchTypes'

export default function SharePage() {
  const params = useParams()
  const shareableId = params.shareableId as string
  
  const [user, setUser] = useState<{ username: string; switches: Switch[]; showForceCurves: boolean; forceCurvePreferences: ForceCurvePreference[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
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

  // Fetch user data
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await fetch(`/api/share/${shareableId}`)
        if (!response.ok) {
          if (response.status === 404) {
            setError('Collection not found')
          } else {
            setError('Failed to load collection')
          }
          return
        }
        const data = await response.json()
        setUser(data)
      } catch (err) {
        setError('Failed to load collection')
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [shareableId])

  // Generate filter options from current switches
  const filterOptions = useMemo((): FilterOptions => {
    if (!user) return {
      manufacturers: [],
      types: [],
      technologies: [],
      topHousings: [],
      bottomHousings: [],
      stems: [],
      topHousingColors: [],
      bottomHousingColors: [],
      stemColors: [],
      markingsList: [],
      springWeights: [],
      springLengths: [],
      magnetOrientations: [],
      magnetPositions: [],
      magnetPolarities: [],
      pcbThicknesses: [],
      compatibilities: [],
      personalTags: [],
      actuationForces: [],
      tactileForces: [],
      bottomOutForces: [],
      preTravels: [],
      bottomOuts: [],
      initialForces: [],
      initialMagneticFluxes: [],
      bottomOutMagneticFluxes: [],
      progressiveSprings: [],
      doubleStages: []
    }

    const switches = user.switches
    const manufacturers = [...new Set(switches.map(s => s.manufacturer).filter(Boolean) as string[])].sort()
    const types = [...new Set(switches.map(s => s.type).filter(Boolean) as string[])].sort()
    const technologies = [...new Set(switches.map(s => s.technology).filter(Boolean) as string[])].sort()
    const topHousings = [...new Set(switches.map(s => s.topHousing).filter(Boolean) as string[])].sort()
    const bottomHousings = [...new Set(switches.map(s => s.bottomHousing).filter(Boolean) as string[])].sort()
    const stems = [...new Set(switches.map(s => s.stem).filter(Boolean) as string[])].sort()
    const topHousingColors = [...new Set(switches.map(s => s.topHousingColor).filter(Boolean) as string[])].sort()
    const bottomHousingColors = [...new Set(switches.map(s => s.bottomHousingColor).filter(Boolean) as string[])].sort()
    const stemColors = [...new Set(switches.map(s => s.stemColor).filter(Boolean) as string[])].sort()
    const markingsList = [...new Set(switches.map(s => s.markings).filter(Boolean) as string[])].sort()
    const springWeights = [...new Set(switches.map(s => s.springWeight).filter(Boolean) as string[])].sort()
    const springLengths = [...new Set(switches.map(s => s.springLength).filter(Boolean) as string[])].sort()
    const magnetOrientations = [...new Set(switches.map(s => s.magnetOrientation).filter(Boolean) as string[])].sort()
    const magnetPositions = [...new Set(switches.map(s => s.magnetPosition).filter(Boolean) as string[])].sort()
    const magnetPolarities = [...new Set(switches.map(s => s.magnetPolarity).filter(Boolean) as string[])].sort()
    const pcbThicknesses = [...new Set(switches.map(s => s.pcbThickness).filter(Boolean) as string[])].sort()
    const compatibilities = [...new Set(switches.map(s => s.compatibility).filter(Boolean) as string[])].sort()
    
    // Extract all unique personal tags
    const personalTags = [...new Set(
      switches.flatMap(s => s.personalTags || [])
    )].sort()
    
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
      topHousingColors,
      bottomHousingColors,
      stemColors,
      markingsList,
      springWeights,
      springLengths,
      magnetOrientations,
      magnetPositions,
      magnetPolarities,
      pcbThicknesses,
      compatibilities,
      personalTags,
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
  }, [user])

  // Filter and sort switches
  const filteredSwitches = useMemo(() => {
    if (!user) return []
    
    let filtered = [...user.switches]

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
        (s.topHousingColor?.toLowerCase().includes(search) ?? false) ||
        (s.bottomHousingColor?.toLowerCase().includes(search) ?? false) ||
        (s.stemColor?.toLowerCase().includes(search) ?? false) ||
        (s.markings?.toLowerCase().includes(search) ?? false) ||
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
    if (activeFilters.topHousingColor) {
      filtered = filtered.filter(s => s.topHousingColor === activeFilters.topHousingColor)
    }
    if (activeFilters.bottomHousingColor) {
      filtered = filtered.filter(s => s.bottomHousingColor === activeFilters.bottomHousingColor)
    }
    if (activeFilters.stemColor) {
      filtered = filtered.filter(s => s.stemColor === activeFilters.stemColor)
    }
    if (activeFilters.markings) {
      filtered = filtered.filter(s => s.markings === activeFilters.markings)
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
    if (activeFilters.personalTag) {
      filtered = filtered.filter(s => s.personalTags?.includes(activeFilters.personalTag!) ?? false)
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
      case 'travel-asc':
        sorted.sort((a, b) => (a.bottomOut || 0) - (b.bottomOut || 0))
        break
      case 'travel-desc':
        sorted.sort((a, b) => (b.bottomOut || 0) - (a.bottomOut || 0))
        break
    }

    return sorted
  }, [user, searchTerm, sortOption, activeFilters])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {error || 'Collection not found'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            This collection may have been removed or the link is invalid.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{user.username}&apos;s Switch Collection</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">{user.switches.length} switches in collection</p>
        </div>

        {user.switches.length > 0 && (
          <div className="mb-8">
            <CollectionStats switches={user.switches} />
          </div>
        )}

        {user.switches.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">No switches in this collection yet.</p>
          </div>
        ) : (
          <>
            <CollectionControls
              onSearchChange={setSearchTerm}
              onSortChange={setSortOption}
              onViewChange={setViewMode}
              onFiltersChange={setActiveFilters}
              currentView={viewMode}
              filterOptions={filterOptions}
            />

            {filteredSwitches.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No switches match your search criteria.</p>
              </div>
            ) : (
              <>
                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredSwitches.map((switchItem) => (
                      <SwitchCard
                        key={switchItem.id}
                        switch={switchItem}
                        onEdit={() => {}}
                        onDelete={() => {}}
                        showForceCurves={user.showForceCurves}
                      />
                    ))}
                  </div>
                ) : (
                  <SwitchTable
                    switches={filteredSwitches}
                    onEdit={() => {}}
                    onDelete={() => {}}
                    showForceCurves={user.showForceCurves}
                  />
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}