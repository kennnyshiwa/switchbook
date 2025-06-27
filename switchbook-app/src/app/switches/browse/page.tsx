'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { SwitchType, SwitchTechnology } from '@prisma/client'
import debounce from 'lodash/debounce'
import AnimatedCounter from '@/components/AnimatedCounter'
import LinkToCollectionDialog from '@/components/LinkToCollectionDialog'
import MasterSwitchDetailsPopup from '@/components/MasterSwitchDetailsPopup'

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
  clickType?: string
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


export default function BrowseMasterSwitchesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [switches, setSwitches] = useState<MasterSwitch[]>([])
  const [filteredSwitches, setFilteredSwitches] = useState<MasterSwitch[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [addingSwitch, setAddingSwitch] = useState<string | null>(null)
  const [deletingSwitch, setDeletingSwitch] = useState<string | null>(null)
  const [linkDialogSwitch, setLinkDialogSwitch] = useState<{ id: string; name: string } | null>(null)
  const [selectedSwitch, setSelectedSwitch] = useState<MasterSwitch | null>(null)
  
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
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Create debounced setters for search (faster) and other filters (slower)
  const debouncedSearchUpdate = useMemo(
    () => debounce((value: string) => {
      setDebouncedSearch(value);
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

  // Fetch all master switches on mount
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/login')
      return
    }

    const fetchAllSwitches = async () => {
      setLoading(true)
      try {
        // Load all switches without pagination
        const params = new URLSearchParams({
          limit: '10000', // High limit to get all switches
          sort: 'name',
          order: 'asc',
        })

        const response = await fetch(`/api/master-switches?${params}`)
        if (response.ok) {
          const data = await response.json()
          setSwitches(data.switches)
          setFilteredSwitches(data.switches)
          setTotalCount(data.pagination.total)
        }
      } catch (error) {
        console.error('Failed to fetch master switches:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchAllSwitches()
  }, [session, status, router])

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
  }

  const hasActiveFilters = search || manufacturer || type || technology || topHousing || bottomHousing || stem || springWeight || springLength || compatibility || magnetOrientation || magnetPosition || magnetPolarity || pcbThickness || progressiveSpring || doubleStage || actuationForceMin || actuationForceMax || tactileForceMin || tactileForceMax || bottomOutForceMin || bottomOutForceMax || preTravelMin || preTravelMax || bottomOutMin || bottomOutMax || initialForceMin || initialForceMax || initialMagneticFluxMin || initialMagneticFluxMax || bottomOutMagneticFluxMin || bottomOutMagneticFluxMax

  // Client-side filtering and sorting
  useEffect(() => {
    let filtered = [...switches]

    // Apply search filter
    if (debouncedSearch) {
      const search = debouncedSearch.toLowerCase()
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(search) ||
        (s.chineseName?.toLowerCase().includes(search) ?? false) ||
        (s.manufacturer?.toLowerCase().includes(search) ?? false) ||
        (s.notes?.toLowerCase().includes(search) ?? false)
      )
    }

    // Apply filters
    if (debouncedManufacturer) {
      filtered = filtered.filter(s => s.manufacturer?.toLowerCase().includes(debouncedManufacturer.toLowerCase()))
    }
    if (type) {
      filtered = filtered.filter(s => s.type === type)
    }
    if (technology) {
      filtered = filtered.filter(s => s.technology === technology)
    }
    if (debouncedTopHousing) {
      filtered = filtered.filter(s => s.topHousing?.toLowerCase().includes(debouncedTopHousing.toLowerCase()))
    }
    if (debouncedBottomHousing) {
      filtered = filtered.filter(s => s.bottomHousing?.toLowerCase().includes(debouncedBottomHousing.toLowerCase()))
    }
    if (debouncedStem) {
      filtered = filtered.filter(s => s.stem?.toLowerCase().includes(debouncedStem.toLowerCase()))
    }
    if (debouncedSpringWeight) {
      filtered = filtered.filter(s => s.springWeight?.toLowerCase().includes(debouncedSpringWeight.toLowerCase()))
    }
    if (debouncedSpringLength) {
      filtered = filtered.filter(s => s.springLength?.toLowerCase().includes(debouncedSpringLength.toLowerCase()))
    }
    if (debouncedCompatibility) {
      filtered = filtered.filter(s => s.compatibility?.toLowerCase().includes(debouncedCompatibility.toLowerCase()))
    }

    // Magnetic filters
    if (magnetOrientation) {
      filtered = filtered.filter(s => s.magnetOrientation === magnetOrientation)
    }
    if (magnetPosition) {
      filtered = filtered.filter(s => s.magnetPosition === magnetPosition)
    }
    if (magnetPolarity) {
      filtered = filtered.filter(s => s.magnetPolarity === magnetPolarity)
    }
    if (pcbThickness) {
      filtered = filtered.filter(s => s.pcbThickness === pcbThickness)
    }

    // Boolean filters
    if (progressiveSpring) {
      filtered = filtered.filter(s => s.progressiveSpring === (progressiveSpring === 'true'))
    }
    if (doubleStage) {
      filtered = filtered.filter(s => s.doubleStage === (doubleStage === 'true'))
    }

    // Force ranges
    if (debouncedActuationForceMin) {
      const min = Number(debouncedActuationForceMin)
      filtered = filtered.filter(s => s.actuationForce !== null && s.actuationForce !== undefined && s.actuationForce >= min)
    }
    if (debouncedActuationForceMax) {
      const max = Number(debouncedActuationForceMax)
      filtered = filtered.filter(s => s.actuationForce !== null && s.actuationForce !== undefined && s.actuationForce <= max)
    }
    if (debouncedTactileForceMin) {
      const min = Number(debouncedTactileForceMin)
      filtered = filtered.filter(s => s.tactileForce !== null && s.tactileForce !== undefined && s.tactileForce >= min)
    }
    if (debouncedTactileForceMax) {
      const max = Number(debouncedTactileForceMax)
      filtered = filtered.filter(s => s.tactileForce !== null && s.tactileForce !== undefined && s.tactileForce <= max)
    }
    if (debouncedBottomOutForceMin) {
      const min = Number(debouncedBottomOutForceMin)
      filtered = filtered.filter(s => s.bottomOutForce !== null && s.bottomOutForce !== undefined && s.bottomOutForce >= min)
    }
    if (debouncedBottomOutForceMax) {
      const max = Number(debouncedBottomOutForceMax)
      filtered = filtered.filter(s => s.bottomOutForce !== null && s.bottomOutForce !== undefined && s.bottomOutForce <= max)
    }

    // Travel ranges
    if (debouncedPreTravelMin) {
      const min = Number(debouncedPreTravelMin)
      filtered = filtered.filter(s => s.preTravel !== null && s.preTravel !== undefined && s.preTravel >= min)
    }
    if (debouncedPreTravelMax) {
      const max = Number(debouncedPreTravelMax)
      filtered = filtered.filter(s => s.preTravel !== null && s.preTravel !== undefined && s.preTravel <= max)
    }
    if (debouncedBottomOutMin) {
      const min = Number(debouncedBottomOutMin)
      filtered = filtered.filter(s => s.bottomOut !== null && s.bottomOut !== undefined && s.bottomOut >= min)
    }
    if (debouncedBottomOutMax) {
      const max = Number(debouncedBottomOutMax)
      filtered = filtered.filter(s => s.bottomOut !== null && s.bottomOut !== undefined && s.bottomOut <= max)
    }

    // Magnetic flux ranges
    if (debouncedInitialForceMin) {
      const min = Number(debouncedInitialForceMin)
      filtered = filtered.filter(s => s.initialForce !== null && s.initialForce !== undefined && s.initialForce >= min)
    }
    if (debouncedInitialForceMax) {
      const max = Number(debouncedInitialForceMax)
      filtered = filtered.filter(s => s.initialForce !== null && s.initialForce !== undefined && s.initialForce <= max)
    }
    if (debouncedInitialMagneticFluxMin) {
      const min = Number(debouncedInitialMagneticFluxMin)
      filtered = filtered.filter(s => s.initialMagneticFlux !== null && s.initialMagneticFlux !== undefined && s.initialMagneticFlux >= min)
    }
    if (debouncedInitialMagneticFluxMax) {
      const max = Number(debouncedInitialMagneticFluxMax)
      filtered = filtered.filter(s => s.initialMagneticFlux !== null && s.initialMagneticFlux !== undefined && s.initialMagneticFlux <= max)
    }
    if (debouncedBottomOutMagneticFluxMin) {
      const min = Number(debouncedBottomOutMagneticFluxMin)
      filtered = filtered.filter(s => s.bottomOutMagneticFlux !== null && s.bottomOutMagneticFlux !== undefined && s.bottomOutMagneticFlux >= min)
    }
    if (debouncedBottomOutMagneticFluxMax) {
      const max = Number(debouncedBottomOutMagneticFluxMax)
      filtered = filtered.filter(s => s.bottomOutMagneticFlux !== null && s.bottomOutMagneticFlux !== undefined && s.bottomOutMagneticFlux <= max)
    }

    // Apply sorting
    const sorted = [...filtered]
    switch (sort) {
      case 'name':
        sorted.sort((a, b) => order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
        break
      case 'viewCount':
        sorted.sort((a, b) => order === 'asc' ? (a.userCount - b.userCount) : (b.userCount - a.userCount))
        break
      case 'createdAt':
        sorted.sort((a, b) => order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)) // Fallback to name since we don't have createdAt
        break
    }

    setFilteredSwitches(sorted)
  }, [switches, debouncedSearch, debouncedManufacturer, type, technology, debouncedTopHousing, debouncedBottomHousing, debouncedStem, debouncedSpringWeight, debouncedSpringLength, debouncedCompatibility, magnetOrientation, magnetPosition, magnetPolarity, pcbThickness, progressiveSpring, doubleStage, debouncedActuationForceMin, debouncedActuationForceMax, debouncedTactileForceMin, debouncedTactileForceMax, debouncedBottomOutForceMin, debouncedBottomOutForceMax, debouncedPreTravelMin, debouncedPreTravelMax, debouncedBottomOutMin, debouncedBottomOutMax, debouncedInitialForceMin, debouncedInitialForceMax, debouncedInitialMagneticFluxMin, debouncedInitialMagneticFluxMax, debouncedBottomOutMagneticFluxMin, debouncedBottomOutMagneticFluxMax, sort, order])

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
        setFilteredSwitches(prev => prev.map(s => 
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

  const deleteSwitch = async (switchId: string) => {
    if (!confirm('Are you sure you want to delete this master switch? This action cannot be undone.')) {
      return
    }

    setDeletingSwitch(switchId)
    try {
      const response = await fetch(`/api/admin/master-switches/${switchId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (response.ok) {
        // Remove the switch from the list
        setSwitches(prev => prev.filter(s => s.id !== switchId))
        setFilteredSwitches(prev => prev.filter(s => s.id !== switchId))
        // Update total count
        setTotalCount(prev => prev - 1)
      } else {
        alert(data.error || 'Failed to delete switch')
      }
    } catch (error) {
      console.error('Failed to delete switch:', error)
      alert('Failed to delete switch')
    } finally {
      setDeletingSwitch(null)
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
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Browse Master Switches
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Discover and add switches from our community-curated database
              </p>
              <div className="mt-2 flex items-center gap-2">
                <AnimatedCounter 
                  end={totalCount} 
                  duration={1500}
                  className="text-2xl font-bold text-blue-600 dark:text-blue-400"
                />
                <span className="text-gray-600 dark:text-gray-400">
                  approved switches in our database
                </span>
                {hasActiveFilters && (
                  <span className="text-gray-500 dark:text-gray-400">
                    ({filteredSwitches.length} matching filters)
                  </span>
                )}
              </div>
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
                onChange={(e) => setType(e.target.value)}
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
                onChange={(e) => setTechnology(e.target.value)}
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
                      onChange={(e) => setProgressiveSpring(e.target.value)}
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
                      onChange={(e) => setDoubleStage(e.target.value)}
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
                      onChange={(e) => setMagnetOrientation(e.target.value)}
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
                      onChange={(e) => setMagnetPosition(e.target.value)}
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
                      onChange={(e) => setMagnetPolarity(e.target.value)}
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
                      onChange={(e) => setPcbThickness(e.target.value)}
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
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow relative overflow-visible">
          {filteredSwitches.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No switches found matching your criteria
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-6">
                {filteredSwitches.map((switchItem) => (
                  <div
                    key={switchItem.id}
                    onClick={() => setSelectedSwitch(switchItem)}
                    className="group cursor-pointer"
                  >
                    <div className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden mb-2 border-2 border-transparent hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-200">
                      {switchItem.imageUrl ? (
                        <img
                          src={switchItem.imageUrl}
                          alt={switchItem.name}
                          className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg className="w-16 h-16 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                          {switchItem.name}
                        </h3>
                        {switchItem.inCollection && (
                          <div className="bg-green-500 text-white p-0.5 rounded-full">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                      </div>
                      {switchItem.manufacturer && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {switchItem.manufacturer}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
      
      {/* Link to Collection Dialog */}
      {linkDialogSwitch && (
        <LinkToCollectionDialog
          masterSwitchId={linkDialogSwitch.id}
          masterSwitchName={linkDialogSwitch.name}
          onClose={() => setLinkDialogSwitch(null)}
          onSuccess={() => {
            setLinkDialogSwitch(null)
            // Refresh the page to update the switch status
            router.refresh()
          }}
        />
      )}
      
      {/* Switch Details Popup */}
      {selectedSwitch && (
        <MasterSwitchDetailsPopup
          switchItem={selectedSwitch}
          onClose={() => setSelectedSwitch(null)}
          onAddToCollection={addToCollection}
          onDeleteSwitch={session?.user?.role === 'ADMIN' ? deleteSwitch : undefined}
          onOpenLinkDialog={setLinkDialogSwitch}
          isAddingSwitch={addingSwitch === selectedSwitch.id}
          isDeletingSwitch={deletingSwitch === selectedSwitch.id}
          isAdmin={session?.user?.role === 'ADMIN'}
        />
      )}
    </div>
  )
}