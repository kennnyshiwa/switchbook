'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { SwitchType, SwitchTechnology } from '@prisma/client'
import debounce from 'lodash/debounce'

interface MasterSwitch {
  id: string
  name: string
  chineseName?: string
  type?: SwitchType
  technology?: SwitchTechnology
  manufacturer?: string
  actuationForce?: number
  tactileForce?: number
  bottomOutForce?: number
  progressiveSpring?: boolean
  doubleStage?: boolean
  preTravel?: number
  bottomOut?: number
  springWeight?: string
  springLength?: string
  notes?: string
  imageUrl?: string
  topHousing?: string
  bottomHousing?: string
  stem?: string
  magnetOrientation?: string
  magnetPosition?: string
  magnetPolarity?: string
  initialForce?: number
  initialMagneticFlux?: number
  bottomOutMagneticFlux?: number
  pcbThickness?: string
  compatibility?: string
  inCollection: boolean
  userCount: number
  submittedBy: {
    id: string
    username: string
  }
}

interface Pagination {
  total: number
  pages: number
  current: number
  limit: number
}

export default function BrowseMasterSwitchesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [switches, setSwitches] = useState<MasterSwitch[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSearching, setIsSearching] = useState(false)
  const [addingSwitch, setAddingSwitch] = useState<string | null>(null)
  
  // Filters - UI state (immediate updates)
  const [search, setSearch] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [topHousing, setTopHousing] = useState('')
  const [bottomHousing, setBottomHousing] = useState('')
  const [stem, setStem] = useState('')
  const [springWeight, setSpringWeight] = useState('')
  const [springLength, setSpringLength] = useState('')
  const [compatibility, setCompatibility] = useState('')
  const [actuationForceMin, setActuationForceMin] = useState('')
  const [actuationForceMax, setActuationForceMax] = useState('')
  const [tactileForceMin, setTactileForceMin] = useState('')
  const [tactileForceMax, setTactileForceMax] = useState('')
  const [bottomOutForceMin, setBottomOutForceMin] = useState('')
  const [bottomOutForceMax, setBottomOutForceMax] = useState('')
  const [preTravelMin, setPreTravelMin] = useState('')
  const [preTravelMax, setPreTravelMax] = useState('')
  const [bottomOutMin, setBottomOutMin] = useState('')
  const [bottomOutMax, setBottomOutMax] = useState('')
  const [initialForceMin, setInitialForceMin] = useState('')
  const [initialForceMax, setInitialForceMax] = useState('')
  const [initialMagneticFluxMin, setInitialMagneticFluxMin] = useState('')
  const [initialMagneticFluxMax, setInitialMagneticFluxMax] = useState('')
  const [bottomOutMagneticFluxMin, setBottomOutMagneticFluxMin] = useState('')
  const [bottomOutMagneticFluxMax, setBottomOutMagneticFluxMax] = useState('')

  // Filters - Debounced state (used for API calls)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [debouncedManufacturer, setDebouncedManufacturer] = useState('')
  const [debouncedTopHousing, setDebouncedTopHousing] = useState('')
  const [debouncedBottomHousing, setDebouncedBottomHousing] = useState('')
  const [debouncedStem, setDebouncedStem] = useState('')
  const [debouncedSpringWeight, setDebouncedSpringWeight] = useState('')
  const [debouncedSpringLength, setDebouncedSpringLength] = useState('')
  const [debouncedCompatibility, setDebouncedCompatibility] = useState('')
  const [debouncedActuationForceMin, setDebouncedActuationForceMin] = useState('')
  const [debouncedActuationForceMax, setDebouncedActuationForceMax] = useState('')
  const [debouncedTactileForceMin, setDebouncedTactileForceMin] = useState('')
  const [debouncedTactileForceMax, setDebouncedTactileForceMax] = useState('')
  const [debouncedBottomOutForceMin, setDebouncedBottomOutForceMin] = useState('')
  const [debouncedBottomOutForceMax, setDebouncedBottomOutForceMax] = useState('')
  const [debouncedPreTravelMin, setDebouncedPreTravelMin] = useState('')
  const [debouncedPreTravelMax, setDebouncedPreTravelMax] = useState('')
  const [debouncedBottomOutMin, setDebouncedBottomOutMin] = useState('')
  const [debouncedBottomOutMax, setDebouncedBottomOutMax] = useState('')
  const [debouncedInitialForceMin, setDebouncedInitialForceMin] = useState('')
  const [debouncedInitialForceMax, setDebouncedInitialForceMax] = useState('')
  const [debouncedInitialMagneticFluxMin, setDebouncedInitialMagneticFluxMin] = useState('')
  const [debouncedInitialMagneticFluxMax, setDebouncedInitialMagneticFluxMax] = useState('')
  const [debouncedBottomOutMagneticFluxMin, setDebouncedBottomOutMagneticFluxMin] = useState('')
  const [debouncedBottomOutMagneticFluxMax, setDebouncedBottomOutMagneticFluxMax] = useState('')

  // Non-text filters (immediate updates)
  const [type, setType] = useState('')
  const [technology, setTechnology] = useState('')
  const [magnetOrientation, setMagnetOrientation] = useState('')
  const [magnetPosition, setMagnetPosition] = useState('')
  const [magnetPolarity, setMagnetPolarity] = useState('')
  const [pcbThickness, setPcbThickness] = useState('')
  const [progressiveSpring, setProgressiveSpring] = useState<string>('')
  const [doubleStage, setDoubleStage] = useState<string>('')
  const [sort, setSort] = useState<'name' | 'viewCount' | 'createdAt'>('name')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Create debounced setters for search (faster) and other filters (slower)
  const debouncedSearchUpdate = useMemo(
    () => debounce((value: string) => {
      setDebouncedSearch(value);
      setPage(1);
    }, 200), // Faster debounce for search
    []
  )
  
  const debouncedFilterUpdate = useMemo(
    () => debounce((updates: Record<string, string>) => {
      Object.entries(updates).forEach(([key, value]) => {
        switch (key) {
          case 'manufacturer': setDebouncedManufacturer(value); break;
          case 'topHousing': setDebouncedTopHousing(value); break;
          case 'bottomHousing': setDebouncedBottomHousing(value); break;
          case 'stem': setDebouncedStem(value); break;
          case 'springWeight': setDebouncedSpringWeight(value); break;
          case 'springLength': setDebouncedSpringLength(value); break;
          case 'compatibility': setDebouncedCompatibility(value); break;
          case 'actuationForceMin': setDebouncedActuationForceMin(value); break;
          case 'actuationForceMax': setDebouncedActuationForceMax(value); break;
          case 'tactileForceMin': setDebouncedTactileForceMin(value); break;
          case 'tactileForceMax': setDebouncedTactileForceMax(value); break;
          case 'bottomOutForceMin': setDebouncedBottomOutForceMin(value); break;
          case 'bottomOutForceMax': setDebouncedBottomOutForceMax(value); break;
          case 'preTravelMin': setDebouncedPreTravelMin(value); break;
          case 'preTravelMax': setDebouncedPreTravelMax(value); break;
          case 'bottomOutMin': setDebouncedBottomOutMin(value); break;
          case 'bottomOutMax': setDebouncedBottomOutMax(value); break;
          case 'initialForceMin': setDebouncedInitialForceMin(value); break;
          case 'initialForceMax': setDebouncedInitialForceMax(value); break;
          case 'initialMagneticFluxMin': setDebouncedInitialMagneticFluxMin(value); break;
          case 'initialMagneticFluxMax': setDebouncedInitialMagneticFluxMax(value); break;
          case 'bottomOutMagneticFluxMin': setDebouncedBottomOutMagneticFluxMin(value); break;
          case 'bottomOutMagneticFluxMax': setDebouncedBottomOutMagneticFluxMax(value); break;
        }
      });
      setPage(1); // Reset to first page when filters change
    }, 400), // Standard debounce for other filters
    []
  )

  // Update debounced search value
  useEffect(() => {
    debouncedSearchUpdate(search);
  }, [search, debouncedSearchUpdate])
  
  // Update debounced filter values
  useEffect(() => {
    debouncedFilterUpdate({
      manufacturer,
      topHousing,
      bottomHousing,
      stem,
      springWeight,
      springLength,
      compatibility,
      actuationForceMin,
      actuationForceMax,
      tactileForceMin,
      tactileForceMax,
      bottomOutForceMin,
      bottomOutForceMax,
      preTravelMin,
      preTravelMax,
      bottomOutMin,
      bottomOutMax,
      initialForceMin,
      initialForceMax,
      initialMagneticFluxMin,
      initialMagneticFluxMax,
      bottomOutMagneticFluxMin,
      bottomOutMagneticFluxMax,
    });
  }, [manufacturer, topHousing, bottomHousing, stem, springWeight, springLength, compatibility, actuationForceMin, actuationForceMax, tactileForceMin, tactileForceMax, bottomOutForceMin, bottomOutForceMax, preTravelMin, preTravelMax, bottomOutMin, bottomOutMax, initialForceMin, initialForceMax, initialMagneticFluxMin, initialMagneticFluxMax, bottomOutMagneticFluxMin, bottomOutMagneticFluxMax, debouncedFilterUpdate])

  // Fetch master switches
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/login')
      return
    }

    const fetchSwitches = async () => {
      // Only show loading spinner on initial load
      if (switches.length === 0) {
        setLoading(true)
      } else {
        setIsSearching(true)
      }
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '50',
          ...(debouncedSearch && { search: debouncedSearch }),
          ...(debouncedManufacturer && { manufacturer: debouncedManufacturer }),
          ...(type && { type }),
          ...(technology && { technology }),
          ...(debouncedTopHousing && { topHousing: debouncedTopHousing }),
          ...(debouncedBottomHousing && { bottomHousing: debouncedBottomHousing }),
          ...(debouncedStem && { stem: debouncedStem }),
          ...(debouncedSpringWeight && { springWeight: debouncedSpringWeight }),
          ...(debouncedSpringLength && { springLength: debouncedSpringLength }),
          ...(debouncedCompatibility && { compatibility: debouncedCompatibility }),
          ...(magnetOrientation && { magnetOrientation }),
          ...(magnetPosition && { magnetPosition }),
          ...(magnetPolarity && { magnetPolarity }),
          ...(pcbThickness && { pcbThickness }),
          ...(progressiveSpring && { progressiveSpring }),
          ...(doubleStage && { doubleStage }),
          ...(debouncedActuationForceMin && { actuationForceMin: debouncedActuationForceMin }),
          ...(debouncedActuationForceMax && { actuationForceMax: debouncedActuationForceMax }),
          ...(debouncedTactileForceMin && { tactileForceMin: debouncedTactileForceMin }),
          ...(debouncedTactileForceMax && { tactileForceMax: debouncedTactileForceMax }),
          ...(debouncedBottomOutForceMin && { bottomOutForceMin: debouncedBottomOutForceMin }),
          ...(debouncedBottomOutForceMax && { bottomOutForceMax: debouncedBottomOutForceMax }),
          ...(debouncedPreTravelMin && { preTravelMin: debouncedPreTravelMin }),
          ...(debouncedPreTravelMax && { preTravelMax: debouncedPreTravelMax }),
          ...(debouncedBottomOutMin && { bottomOutMin: debouncedBottomOutMin }),
          ...(debouncedBottomOutMax && { bottomOutMax: debouncedBottomOutMax }),
          ...(debouncedInitialForceMin && { initialForceMin: debouncedInitialForceMin }),
          ...(debouncedInitialForceMax && { initialForceMax: debouncedInitialForceMax }),
          ...(debouncedInitialMagneticFluxMin && { initialMagneticFluxMin: debouncedInitialMagneticFluxMin }),
          ...(debouncedInitialMagneticFluxMax && { initialMagneticFluxMax: debouncedInitialMagneticFluxMax }),
          ...(debouncedBottomOutMagneticFluxMin && { bottomOutMagneticFluxMin: debouncedBottomOutMagneticFluxMin }),
          ...(debouncedBottomOutMagneticFluxMax && { bottomOutMagneticFluxMax: debouncedBottomOutMagneticFluxMax }),
          sort,
          order,
        })

        const response = await fetch(`/api/master-switches?${params}`)
        if (response.ok) {
          const data = await response.json()
          setSwitches(data.switches)
          setPagination(data.pagination)
        }
      } catch (error) {
        console.error('Failed to fetch master switches:', error)
      } finally {
        setLoading(false)
        setIsSearching(false)
      }
    }

    fetchSwitches()
  }, [session, status, router, page, debouncedSearch, debouncedManufacturer, type, technology, debouncedTopHousing, debouncedBottomHousing, debouncedStem, debouncedSpringWeight, debouncedSpringLength, debouncedCompatibility, magnetOrientation, magnetPosition, magnetPolarity, pcbThickness, progressiveSpring, doubleStage, debouncedActuationForceMin, debouncedActuationForceMax, debouncedTactileForceMin, debouncedTactileForceMax, debouncedBottomOutForceMin, debouncedBottomOutForceMax, debouncedPreTravelMin, debouncedPreTravelMax, debouncedBottomOutMin, debouncedBottomOutMax, debouncedInitialForceMin, debouncedInitialForceMax, debouncedInitialMagneticFluxMin, debouncedInitialMagneticFluxMax, debouncedBottomOutMagneticFluxMin, debouncedBottomOutMagneticFluxMax, sort, order])

  const clearAllFilters = () => {
    setSearch('')
    setManufacturer('')
    setType('')
    setTechnology('')
    setTopHousing('')
    setBottomHousing('')
    setStem('')
    setSpringWeight('')
    setSpringLength('')
    setCompatibility('')
    setMagnetOrientation('')
    setMagnetPosition('')
    setMagnetPolarity('')
    setPcbThickness('')
    setActuationForceMin('')
    setActuationForceMax('')
    setTactileForceMin('')
    setTactileForceMax('')
    setBottomOutForceMin('')
    setBottomOutForceMax('')
    setProgressiveSpring('')
    setDoubleStage('')
    setPreTravelMin('')
    setPreTravelMax('')
    setBottomOutMin('')
    setBottomOutMax('')
    setInitialForceMin('')
    setInitialForceMax('')
    setInitialMagneticFluxMin('')
    setInitialMagneticFluxMax('')
    setBottomOutMagneticFluxMin('')
    setBottomOutMagneticFluxMax('')
    // Page reset will be handled by debounced update
  }

  const hasActiveFilters = search || manufacturer || type || technology || topHousing || bottomHousing || stem || springWeight || springLength || compatibility || magnetOrientation || magnetPosition || magnetPolarity || pcbThickness || progressiveSpring || doubleStage || actuationForceMin || actuationForceMax || tactileForceMin || tactileForceMax || bottomOutForceMin || bottomOutForceMax || preTravelMin || preTravelMax || bottomOutMin || bottomOutMax || initialForceMin || initialForceMax || initialMagneticFluxMin || initialMagneticFluxMax || bottomOutMagneticFluxMin || bottomOutMagneticFluxMax

  const addToCollection = async (switchId: string) => {
    setAddingSwitch(switchId)
    try {
      const response = await fetch(`/api/master-switches/${switchId}/add-to-collection`, {
        method: 'POST',
      })

      if (response.ok) {
        const data = await response.json()
        // Update the switch in the list to show it's now in collection
        setSwitches(prev => prev.map(s => 
          s.id === switchId ? { ...s, inCollection: true } : s
        ))
        // Optionally redirect to the switch in their collection
        // router.push(`/dashboard/switches/${data.switchId}`)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add switch to collection')
      }
    } catch (error) {
      console.error('Failed to add switch:', error)
      alert('Failed to add switch to collection')
    } finally {
      setAddingSwitch(null)
    }
  }

  if (status === 'loading' || (loading && switches.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading switches...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                Browse Master Switches
                {isSearching && (
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400 flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating results...
                  </span>
                )}
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Discover and add switches from our community-curated database
              </p>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/switches/submit"
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Submit New Switch
              </Link>
              <Link
                href="/dashboard"
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                ← Back to Dashboard
              </Link>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          {/* Basic Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search switches..."
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 pr-8 text-sm"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Manufacturer
              </label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="Filter by manufacturer..."
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value)
                  setPage(1) // Keep immediate page reset for dropdowns
                }}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
              >
                <option value="">All Types</option>
                <option value="LINEAR">Linear</option>
                <option value="TACTILE">Tactile</option>
                <option value="CLICKY">Clicky</option>
                <option value="SILENT_LINEAR">Silent Linear</option>
                <option value="SILENT_TACTILE">Silent Tactile</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Technology
              </label>
              <select
                value={technology}
                onChange={(e) => {
                  setTechnology(e.target.value)
                  setPage(1) // Keep immediate page reset for dropdowns
                }}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
              >
                <option value="">All Technologies</option>
                <option value="MECHANICAL">Mechanical</option>
                <option value="OPTICAL">Optical</option>
                <option value="MAGNETIC">Magnetic</option>
                <option value="INDUCTIVE">Inductive</option>
                <option value="ELECTRO_CAPACITIVE">Electro Capacitive</option>
              </select>
            </div>
          </div>

          {/* Advanced Filters Toggle */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
            >
              <svg 
                className={`w-4 h-4 transform transition-transform ${showAdvancedFilters ? 'rotate-180' : ''}`} 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
              {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
            </button>

            <div className="flex items-center gap-4">
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Clear All Filters
                </button>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sort By
                </label>
                <select
                  value={`${sort}-${order}`}
                  onChange={(e) => {
                    const [newSort, newOrder] = e.target.value.split('-') as [typeof sort, typeof order]
                    setSort(newSort)
                    setOrder(newOrder)
                    setPage(1) // Keep immediate page reset for sort changes
                  }}
                  className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                >
                  <option value="name-asc">Name (A-Z)</option>
                  <option value="name-desc">Name (Z-A)</option>
                  <option value="viewCount-desc">Most Popular</option>
                  <option value="createdAt-desc">Recently Added</option>
                </select>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-6">
              {/* Materials */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Materials</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Top Housing
                    </label>
                    <input
                      type="text"
                      value={topHousing}
                      onChange={(e) => setTopHousing(e.target.value)}
                      placeholder="e.g., Polycarbonate"
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bottom Housing
                    </label>
                    <input
                      type="text"
                      value={bottomHousing}
                      onChange={(e) => setBottomHousing(e.target.value)}
                      placeholder="e.g., Nylon"
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Stem
                    </label>
                    <input
                      type="text"
                      value={stem}
                      onChange={(e) => setStem(e.target.value)}
                      placeholder="e.g., POM"
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Spring & Physical */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Spring & Physical</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Spring Weight
                    </label>
                    <input
                      type="text"
                      value={springWeight}
                      onChange={(e) => setSpringWeight(e.target.value)}
                      placeholder="e.g., 62g"
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Spring Length
                    </label>
                    <input
                      type="text"
                      value={springLength}
                      onChange={(e) => setSpringLength(e.target.value)}
                      placeholder="e.g., 14mm"
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Compatibility
                    </label>
                    <input
                      type="text"
                      value={compatibility}
                      onChange={(e) => setCompatibility(e.target.value)}
                      placeholder="e.g., MX-style"
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Progressive Spring
                    </label>
                    <select
                      value={progressiveSpring}
                      onChange={(e) => {
                        setProgressiveSpring(e.target.value)
                        setPage(1)
                      }}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    >
                      <option value="">Any</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Double Stage
                    </label>
                    <select
                      value={doubleStage}
                      onChange={(e) => {
                        setDoubleStage(e.target.value)
                        setPage(1)
                      }}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    >
                      <option value="">Any</option>
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Force Ranges */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Force Specifications (grams)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Initial Force Range
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={initialForceMin}
                        onChange={(e) => setInitialForceMin(e.target.value)}
                        placeholder="Min"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                      <span className="self-center text-gray-500">-</span>
                      <input
                        type="number"
                        value={initialForceMax}
                        onChange={(e) => setInitialForceMax(e.target.value)}
                        placeholder="Max"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Actuation Force Range
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={actuationForceMin}
                        onChange={(e) => setActuationForceMin(e.target.value)}
                        placeholder="Min"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                      <span className="self-center text-gray-500">-</span>
                      <input
                        type="number"
                        value={actuationForceMax}
                        onChange={(e) => setActuationForceMax(e.target.value)}
                        placeholder="Max"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  {(type === 'TACTILE' || type === 'SILENT_TACTILE') && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tactile Force Range
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={tactileForceMin}
                          onChange={(e) => setTactileForceMin(e.target.value)}
                          placeholder="Min"
                          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                        />
                        <span className="self-center text-gray-500">-</span>
                        <input
                          type="number"
                          value={tactileForceMax}
                          onChange={(e) => setTactileForceMax(e.target.value)}
                          placeholder="Max"
                          className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bottom Out Force Range
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={bottomOutForceMin}
                        onChange={(e) => setBottomOutForceMin(e.target.value)}
                        placeholder="Min"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                      <span className="self-center text-gray-500">-</span>
                      <input
                        type="number"
                        value={bottomOutForceMax}
                        onChange={(e) => setBottomOutForceMax(e.target.value)}
                        placeholder="Max"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Travel Ranges */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Travel Distances (mm)</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Pre-Travel Range
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={preTravelMin}
                        onChange={(e) => setPreTravelMin(e.target.value)}
                        placeholder="Min"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                      <span className="self-center text-gray-500">-</span>
                      <input
                        type="number"
                        step="0.01"
                        value={preTravelMax}
                        onChange={(e) => setPreTravelMax(e.target.value)}
                        placeholder="Max"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Total Travel Range
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        step="0.01"
                        value={bottomOutMin}
                        onChange={(e) => setBottomOutMin(e.target.value)}
                        placeholder="Min"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                      <span className="self-center text-gray-500">-</span>
                      <input
                        type="number"
                        step="0.01"
                        value={bottomOutMax}
                        onChange={(e) => setBottomOutMax(e.target.value)}
                        placeholder="Max"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Magnetic Properties */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Magnetic Properties</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Orientation
                    </label>
                    <select
                      value={magnetOrientation}
                      onChange={(e) => {
                        setMagnetOrientation(e.target.value)
                        setPage(1)
                      }}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    >
                      <option value="">All Orientations</option>
                      <option value="Horizontal">Horizontal</option>
                      <option value="Vertical">Vertical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Position
                    </label>
                    <select
                      value={magnetPosition}
                      onChange={(e) => {
                        setMagnetPosition(e.target.value)
                        setPage(1)
                      }}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    >
                      <option value="">All Positions</option>
                      <option value="Center">Center</option>
                      <option value="Off-Center">Off-Center</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Polarity
                    </label>
                    <select
                      value={magnetPolarity}
                      onChange={(e) => {
                        setMagnetPolarity(e.target.value)
                        setPage(1)
                      }}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    >
                      <option value="">All Polarities</option>
                      <option value="North">North</option>
                      <option value="South">South</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      PCB Thickness
                    </label>
                    <select
                      value={pcbThickness}
                      onChange={(e) => {
                        setPcbThickness(e.target.value)
                        setPage(1)
                      }}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    >
                      <option value="">All Thicknesses</option>
                      <option value="1.2mm">1.2mm</option>
                      <option value="1.6mm">1.6mm</option>
                    </select>
                  </div>
                </div>
                
                {/* Magnetic Flux Ranges */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Initial Magnetic Flux Range (Gs)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={initialMagneticFluxMin}
                        onChange={(e) => setInitialMagneticFluxMin(e.target.value)}
                        placeholder="Min"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                      <span className="self-center text-gray-500">-</span>
                      <input
                        type="number"
                        value={initialMagneticFluxMax}
                        onChange={(e) => setInitialMagneticFluxMax(e.target.value)}
                        placeholder="Max"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bottom Out Magnetic Flux Range (Gs)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        value={bottomOutMagneticFluxMin}
                        onChange={(e) => setBottomOutMagneticFluxMin(e.target.value)}
                        placeholder="Min"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                      <span className="self-center text-gray-500">-</span>
                      <input
                        type="number"
                        value={bottomOutMagneticFluxMax}
                        onChange={(e) => setBottomOutMagneticFluxMax(e.target.value)}
                        placeholder="Max"
                        className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Results */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow relative">
          {/* Loading overlay */}
          {isSearching && (
            <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 z-10 flex items-center justify-center rounded-lg">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Searching...</p>
              </div>
            </div>
          )}
          
          {switches.length === 0 && !isSearching ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No switches found matching your criteria
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
                {switches.map((switchItem) => (
                  <div
                    key={switchItem.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition-shadow flex flex-col"
                  >
                    {/* Image Section */}
                    {switchItem.imageUrl && (
                      <div className="relative h-48 bg-gray-100 dark:bg-gray-900 flex-shrink-0">
                        <img
                          src={switchItem.imageUrl}
                          alt={switchItem.name}
                          className="w-full h-full object-contain"
                        />
                      </div>
                    )}
                    
                    <div className="p-4 flex flex-col flex-grow max-h-[400px]">
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex-shrink-0">
                        {switchItem.name}
                        {switchItem.chineseName && (
                          <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                            {switchItem.chineseName}
                          </span>
                        )}
                      </h3>

                      <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-4 overflow-y-auto flex-grow">
                      {/* Basic Info */}
                      {switchItem.manufacturer && (
                        <p><span className="font-medium">Manufacturer:</span> {switchItem.manufacturer}</p>
                      )}
                      {switchItem.type && (
                        <p><span className="font-medium">Type:</span> {switchItem.type.replace('_', ' ')}</p>
                      )}
                      {switchItem.technology && (
                        <p><span className="font-medium">Technology:</span> {switchItem.technology.replace('_', ' ')}</p>
                      )}
                      
                      {/* Force Specifications */}
                      <div className="pt-1">
                        {switchItem.actuationForce && (
                          <p><span className="font-medium">Actuation:</span> {switchItem.actuationForce}g</p>
                        )}
                        {switchItem.tactileForce && (
                          <p><span className="font-medium">Tactile:</span> {switchItem.tactileForce}g</p>
                        )}
                        {switchItem.bottomOutForce && (
                          <p><span className="font-medium">Bottom Out:</span> {switchItem.bottomOutForce}g</p>
                        )}
                        {switchItem.initialForce && (
                          <p><span className="font-medium">Initial Force:</span> {switchItem.initialForce}g</p>
                        )}
                      </div>
                      
                      {/* Travel Distances */}
                      <div className="pt-1">
                        {switchItem.preTravel && (
                          <p><span className="font-medium">Pre Travel:</span> {switchItem.preTravel}mm</p>
                        )}
                        {switchItem.bottomOut && (
                          <p><span className="font-medium">Total Travel:</span> {switchItem.bottomOut}mm</p>
                        )}
                      </div>
                      
                      {/* Spring Specifications */}
                      {(switchItem.springWeight || switchItem.springLength || switchItem.progressiveSpring || switchItem.doubleStage) && (
                        <div className="pt-1">
                          {switchItem.springWeight && (
                            <p><span className="font-medium">Spring:</span> {switchItem.springWeight}</p>
                          )}
                          {switchItem.springLength && (
                            <p><span className="font-medium">Spring Length:</span> {switchItem.springLength}</p>
                          )}
                          {switchItem.progressiveSpring && (
                            <p><span className="font-medium">Progressive Spring:</span> Yes</p>
                          )}
                          {switchItem.doubleStage && (
                            <p><span className="font-medium">Double Stage:</span> Yes</p>
                          )}
                        </div>
                      )}
                      
                      {/* Materials */}
                      {(switchItem.topHousing || switchItem.bottomHousing || switchItem.stem) && (
                        <div className="pt-1">
                          {switchItem.topHousing && (
                            <p><span className="font-medium">Top Housing:</span> {switchItem.topHousing}</p>
                          )}
                          {switchItem.bottomHousing && (
                            <p><span className="font-medium">Bottom Housing:</span> {switchItem.bottomHousing}</p>
                          )}
                          {switchItem.stem && (
                            <p><span className="font-medium">Stem:</span> {switchItem.stem}</p>
                          )}
                        </div>
                      )}
                      
                      {/* Magnetic Properties (for magnetic switches) */}
                      {switchItem.technology === 'MAGNETIC' && (
                        <div className="pt-1">
                          {switchItem.magnetOrientation && (
                            <p><span className="font-medium">Magnet Orientation:</span> {switchItem.magnetOrientation}</p>
                          )}
                          {switchItem.magnetPosition && (
                            <p><span className="font-medium">Magnet Position:</span> {switchItem.magnetPosition}</p>
                          )}
                          {switchItem.magnetPolarity && (
                            <p><span className="font-medium">Magnet Polarity:</span> {switchItem.magnetPolarity}</p>
                          )}
                          {switchItem.initialMagneticFlux && (
                            <p><span className="font-medium">Initial Flux:</span> {switchItem.initialMagneticFlux}</p>
                          )}
                          {switchItem.bottomOutMagneticFlux && (
                            <p><span className="font-medium">Bottom Out Flux:</span> {switchItem.bottomOutMagneticFlux}</p>
                          )}
                        </div>
                      )}
                      
                      {/* Additional Info */}
                      {switchItem.pcbThickness && (
                        <p><span className="font-medium">PCB Thickness:</span> {switchItem.pcbThickness}</p>
                      )}
                      {switchItem.compatibility && (
                        <p><span className="font-medium">Compatibility:</span> {switchItem.compatibility}</p>
                      )}
                      
                      {/* Notes */}
                      {switchItem.notes && (
                        <div className="pt-1">
                          <p className="text-xs italic">{switchItem.notes}</p>
                        </div>
                      )}
                      
                      {/* User Count */}
                      <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                        Used by {switchItem.userCount} {switchItem.userCount === 1 ? 'person' : 'people'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between flex-shrink-0 pt-2 border-t border-gray-200 dark:border-gray-700">
                      {switchItem.inCollection ? (
                        <span className="text-green-600 dark:text-green-400 text-sm">
                          ✓ In your collection
                        </span>
                      ) : (
                        <button
                          onClick={() => addToCollection(switchItem.id)}
                          disabled={addingSwitch === switchItem.id}
                          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          {addingSwitch === switchItem.id ? 'Adding...' : 'Add to Collection'}
                        </button>
                      )}
                      
                      <button
                        onClick={() => router.push(`/switches/${switchItem.id}`)}
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 text-sm"
                      >
                        View Details →
                      </button>
                    </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.pages > 1 && (
                <div className="border-t border-gray-200 dark:border-gray-700 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      Showing {((pagination.current - 1) * pagination.limit) + 1} to{' '}
                      {Math.min(pagination.current * pagination.limit, pagination.total)} of{' '}
                      {pagination.total} switches
                    </div>
                    
                    <div className="flex space-x-2">
                      <button
                        onClick={() => setPage(page - 1)}
                        disabled={page === 1}
                        className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      
                      <span className="px-3 py-1">
                        Page {pagination.current} of {pagination.pages}
                      </span>
                      
                      <button
                        onClick={() => setPage(page + 1)}
                        disabled={page === pagination.pages}
                        className="px-3 py-1 rounded-md bg-gray-100 dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}