'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { SwitchType, SwitchTechnology } from '@prisma/client'
import debounce from 'lodash/debounce'
import AnimatedCounter from '@/components/AnimatedCounter'
import LinkToCollectionDialog from '@/components/LinkToCollectionDialog'
import MasterSwitchDetailsPopup from '@/components/MasterSwitchDetailsPopup'
import SwitchesDBComparison from '@/components/SwitchesDBComparison'
import VirtualSwitchList from '@/components/VirtualSwitchList'
import type { ActiveFilters } from '@/components/CollectionControls'
import { applySwitchFilters, deriveSwitchFilterOptions } from '@/lib/switch-filters'

interface SwitchImage {
  id: string
  url: string
  type: 'UPLOADED' | 'LINKED'
  order: number
  caption?: string | null
}

export interface MasterSwitch {
  id: string
  shareableId?: string | null
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
  clickType?: 'CLICK_LEAF' | 'CLICK_BAR' | 'CLICK_JACKET'
  preTravel?: number
  bottomOut?: number
  springWeight?: string
  springLength?: string
  notes?: string
  imageUrl?: string
  images?: SwitchImage[]
  topHousing?: string
  bottomHousing?: string
  stem?: string
  stemShape?: string
  topHousingColor?: string
  bottomHousingColor?: string
  stemColor?: string
  markings?: string
  magnetOrientation?: string
  magnetPosition?: string
  magnetPolarity?: string
  initialForce?: number
  initialMagneticFlux?: number
  bottomOutMagneticFlux?: number
  pcbThickness?: string
  compatibility?: string
  inCollection: boolean
  inWishlist: boolean
  userCount: number
  hasForceCurve: boolean
  submittedBy: {
    id: string
    username: string
  }
}


export default function BrowseMasterSwitchesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [switches, setSwitches] = useState<MasterSwitch[]>([])
  const [filteredSwitches, setFilteredSwitches] = useState<MasterSwitch[]>([])
  const [loading, setLoading] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const [addingSwitch, setAddingSwitch] = useState<string | null>(null)
  const [addingToWishlist, setAddingToWishlist] = useState<string | null>(null)
  const [deletingSwitch, setDeletingSwitch] = useState<string | null>(null)
  const [linkDialogSwitch, setLinkDialogSwitch] = useState<{ id: string; name: string } | null>(null)
  const [selectedSwitch, setSelectedSwitch] = useState<MasterSwitch | null>(null)
  const [isComparisonMode, setIsComparisonMode] = useState(false)
  const [selectedForComparison, setSelectedForComparison] = useState<Set<string>>(new Set())
  const [showComparisonModal, setShowComparisonModal] = useState(false)
  
  // Pagination state
  
  
  // Filters - UI state (immediate updates)
  const [search, setSearch] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [topHousing, setTopHousing] = useState('')
  const [bottomHousing, setBottomHousing] = useState('')
  const [stem, setStem] = useState('')
  const [topHousingColor, setTopHousingColor] = useState('')
  const [bottomHousingColor, setBottomHousingColor] = useState('')
  const [stemColor, setStemColor] = useState('')
  const [markings, setMarkings] = useState('')
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
  const [debouncedTopHousingColor, setDebouncedTopHousingColor] = useState('')
  const [debouncedBottomHousingColor, setDebouncedBottomHousingColor] = useState('')
  const [debouncedStemColor, setDebouncedStemColor] = useState('')
  const [debouncedMarkings, setDebouncedMarkings] = useState('')
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
  
  // Initialize sort and order from URL parameters
  const sortParam = searchParams.get('sort') as 'name' | 'viewCount' | 'createdAt' | null
  const orderParam = searchParams.get('order') as 'asc' | 'desc' | null
  
  const [sort, setSort] = useState<'name' | 'viewCount' | 'createdAt'>(
    sortParam && ['name', 'viewCount', 'createdAt'].includes(sortParam) ? sortParam : 'createdAt'
  )
  const [order, setOrder] = useState<'asc' | 'desc'>(
    orderParam && ['asc', 'desc'].includes(orderParam) ? orderParam : 'desc'
  )
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)

  // Update URL when sort or order changes
  const updateURLParams = useCallback((newSort?: string, newOrder?: string) => {
    const params = new URLSearchParams(searchParams.toString())
    
    if (newSort !== undefined) {
      params.set('sort', newSort)
    }
    if (newOrder !== undefined) {
      params.set('order', newOrder)
    }
    
    router.replace(`/switches/browse?${params.toString()}`, { scroll: false })
  }, [router, searchParams])

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
          case 'topHousingColor': setDebouncedTopHousingColor(value); break;
          case 'bottomHousingColor': setDebouncedBottomHousingColor(value); break;
          case 'stemColor': setDebouncedStemColor(value); break;
          case 'markings': setDebouncedMarkings(value); break;
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
      topHousingColor,
      bottomHousingColor,
      stemColor,
      markings,
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
  }, [manufacturer, topHousing, bottomHousing, stem, topHousingColor, bottomHousingColor, stemColor, markings, springWeight, springLength, compatibility, actuationForceMin, actuationForceMax, tactileForceMin, tactileForceMax, bottomOutForceMin, bottomOutForceMax, preTravelMin, preTravelMax, bottomOutMin, bottomOutMax, initialForceMin, initialForceMax, initialMagneticFluxMin, initialMagneticFluxMax, bottomOutMagneticFluxMin, bottomOutMagneticFluxMax, debouncedFilterUpdate])

  // Function to fetch switches with pagination
  const fetchSwitches = useCallback(async (page: number, append: boolean = false) => {
    setLoading(true)
    
    try {
      const params = new URLSearchParams({
        limit: '0',
        page: '1',
        sort: sort,
        order: order,
      })

      const response = await fetch(`/api/master-switches?${params}`)
      if (response.ok) {
        const data = await response.json()
        
        setSwitches(data.switches)
        setTotalCount(data.switches.length)
      }
    } catch (error) {
      console.error('Failed to fetch master switches:', error)
    } finally {
      setLoading(false)
    }
  }, [sort, order])

  // Fetch all switches once on mount
  useEffect(() => {
    if (status === 'loading') return

    setLoading(true)
    fetchSwitches(1, false)
  }, [session, status, fetchSwitches])

  const clearAllFilters = () => {
    setSearch('')
    setManufacturer('')
    setType('')
    setTechnology('')
    setTopHousing('')
    setBottomHousing('')
    setStem('')
    setTopHousingColor('')
    setBottomHousingColor('')
    setStemColor('')
    setMarkings('')
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

  const hasActiveFilters = search || manufacturer || type || technology || topHousing || bottomHousing || stem || topHousingColor || bottomHousingColor || stemColor || markings || springWeight || springLength || compatibility || magnetOrientation || magnetPosition || magnetPolarity || pcbThickness || progressiveSpring || doubleStage || actuationForceMin || actuationForceMax || tactileForceMin || tactileForceMax || bottomOutForceMin || bottomOutForceMax || preTravelMin || preTravelMax || bottomOutMin || bottomOutMax || initialForceMin || initialForceMax || initialMagneticFluxMin || initialMagneticFluxMax || bottomOutMagneticFluxMin || bottomOutMagneticFluxMax

  const filterOptions = useMemo(() => deriveSwitchFilterOptions(switches), [switches])

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

    const numberOrUndefined = (value: string) => value === '' ? undefined : Number(value)
    const activeFilters: ActiveFilters = {
      manufacturer: debouncedManufacturer || undefined, type: type || undefined, technology: technology || undefined,
      topHousing: debouncedTopHousing || undefined, bottomHousing: debouncedBottomHousing || undefined, stem: debouncedStem || undefined,
      topHousingColor: debouncedTopHousingColor || undefined, bottomHousingColor: debouncedBottomHousingColor || undefined,
      stemColor: debouncedStemColor || undefined, markings: debouncedMarkings || undefined,
      springWeight: debouncedSpringWeight || undefined, springLength: debouncedSpringLength || undefined,
      compatibility: debouncedCompatibility || undefined, magnetOrientation: magnetOrientation || undefined,
      magnetPosition: magnetPosition || undefined, magnetPolarity: magnetPolarity || undefined, pcbThickness: pcbThickness || undefined,
      progressiveSpring: progressiveSpring === '' ? undefined : progressiveSpring === 'true',
      doubleStage: doubleStage === '' ? undefined : doubleStage === 'true',
      actuationForceMin: numberOrUndefined(debouncedActuationForceMin), actuationForceMax: numberOrUndefined(debouncedActuationForceMax),
      tactileForceMin: numberOrUndefined(debouncedTactileForceMin), tactileForceMax: numberOrUndefined(debouncedTactileForceMax),
      bottomOutForceMin: numberOrUndefined(debouncedBottomOutForceMin), bottomOutForceMax: numberOrUndefined(debouncedBottomOutForceMax),
      preTravelMin: numberOrUndefined(debouncedPreTravelMin), preTravelMax: numberOrUndefined(debouncedPreTravelMax),
      bottomOutMin: numberOrUndefined(debouncedBottomOutMin), bottomOutMax: numberOrUndefined(debouncedBottomOutMax),
      initialForceMin: numberOrUndefined(debouncedInitialForceMin), initialForceMax: numberOrUndefined(debouncedInitialForceMax),
      initialMagneticFluxMin: numberOrUndefined(debouncedInitialMagneticFluxMin), initialMagneticFluxMax: numberOrUndefined(debouncedInitialMagneticFluxMax),
      bottomOutMagneticFluxMin: numberOrUndefined(debouncedBottomOutMagneticFluxMin), bottomOutMagneticFluxMax: numberOrUndefined(debouncedBottomOutMagneticFluxMax),
    }
    filtered = applySwitchFilters(filtered, activeFilters)

    // Apply sorting
    // Only sort client-side for name and viewCount
    // createdAt sorting is handled by the API
    const sorted = [...filtered]
    switch (sort) {
      case 'name':
        sorted.sort((a, b) => order === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name))
        break
      case 'viewCount':
        sorted.sort((a, b) => order === 'asc' ? (a.userCount - b.userCount) : (b.userCount - a.userCount))
        break
      case 'createdAt':
        // Don't re-sort - the API already sorted by createdAt
        // Just use the filtered results as-is
        break
    }

    setFilteredSwitches(sorted)
  }, [switches, debouncedSearch, debouncedManufacturer, type, technology, debouncedTopHousing, debouncedBottomHousing, debouncedStem, debouncedTopHousingColor, debouncedBottomHousingColor, debouncedStemColor, debouncedMarkings, debouncedSpringWeight, debouncedSpringLength, debouncedCompatibility, magnetOrientation, magnetPosition, magnetPolarity, pcbThickness, progressiveSpring, doubleStage, debouncedActuationForceMin, debouncedActuationForceMax, debouncedTactileForceMin, debouncedTactileForceMax, debouncedBottomOutForceMin, debouncedBottomOutForceMax, debouncedPreTravelMin, debouncedPreTravelMax, debouncedBottomOutMin, debouncedBottomOutMax, debouncedInitialForceMin, debouncedInitialForceMax, debouncedInitialMagneticFluxMin, debouncedInitialMagneticFluxMax, debouncedBottomOutMagneticFluxMin, debouncedBottomOutMagneticFluxMax, sort, order])

  

  const addToCollection = async (switchId: string) => {
    if (!session) {
      router.push('/auth/register')
      return
    }
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
        // Update the selected switch if it's open in the popup
        if (selectedSwitch && selectedSwitch.id === switchId) {
          setSelectedSwitch({ ...selectedSwitch, inCollection: true })
        }
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

  const addToWishlist = async (switchId: string) => {
    if (!session) {
      router.push('/auth/register')
      return
    }
    setAddingToWishlist(switchId)
    try {
      const response = await fetch('/api/wishlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          masterSwitchId: switchId,
        }),
      })

      if (response.ok) {
        // Update the switch in the list to show it's now in wishlist
        setSwitches(prev => prev.map(s => 
          s.id === switchId ? { ...s, inWishlist: true } : s
        ))
        setFilteredSwitches(prev => prev.map(s => 
          s.id === switchId ? { ...s, inWishlist: true } : s
        ))
        // Update the selected switch if it's open in the popup
        if (selectedSwitch && selectedSwitch.id === switchId) {
          setSelectedSwitch({ ...selectedSwitch, inWishlist: true })
        }
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to add switch to wishlist')
      }
    } catch (error) {
      console.error('Failed to add to wishlist:', error)
      alert('Failed to add switch to wishlist')
    } finally {
      setAddingToWishlist(null)
    }
  }

  const handleSwitchClick = (switchItem: MasterSwitch) => {
    if (isComparisonMode) {
      setSelectedForComparison(prev => {
        const newSet = new Set(prev)
        if (newSet.has(switchItem.id)) {
          newSet.delete(switchItem.id)
        } else {
          newSet.add(switchItem.id)
        }
        return newSet
      })
    } else {
      setSelectedSwitch(switchItem)
    }
  }

  const toggleComparisonMode = () => {
    if (isComparisonMode && selectedForComparison.size > 0) {
      // Show comparison modal when exiting comparison mode with selections
      setShowComparisonModal(true)
    }
    setIsComparisonMode(!isComparisonMode)
    if (!isComparisonMode) {
      setSelectedForComparison(new Set())
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
          {!session && (
            <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/40 dark:text-blue-100">
              Browse freely. Create an account to collect switches, build a wishlist, and submit new entries.
            </div>
          )}
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
              <button
                onClick={toggleComparisonMode}
                className={`px-4 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                  isComparisonMode
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-gray-600 text-white hover:bg-gray-700'
                }`}
                title="Compare force curves"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                {isComparisonMode ? `Compare (${selectedForComparison.size})` : 'Compare Curves'}
              </button>
              <Link
                href={session ? "/switches/submit" : "/auth/register"}
                className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                {session ? 'Submit New Switch' : 'Sign Up to Contribute'}
              </Link>
              <Link
                href={session ? "/dashboard" : "/"}
                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {session ? '← Back to Dashboard' : '← Back to Home'}
              </Link>
            </div>
          </div>
        </div>

        {/* Comparison Mode Notice */}
        {isComparisonMode && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-blue-800 dark:text-blue-200">
                  Click on switches to select them for force curve comparison.
                  {selectedForComparison.size > 0 && (
                    <span className="font-semibold ml-1">
                      ({selectedForComparison.size} selected)
                    </span>
                  )}
                </p>
              </div>
              {selectedForComparison.size >= 2 && (
                <button
                  onClick={() => setShowComparisonModal(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                >
                  View Comparison
                </button>
              )}
            </div>
          </div>
        )}

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
              <select
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
              >
                <option value="">All Manufacturers</option>
                {filterOptions.manufacturers.map(value => <option key={value} value={value}>{value}</option>)}
              </select>
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
                {filterOptions.types.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
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
                {filterOptions.technologies.map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}
              </select>
            </div>
          </div>

          {/* Sort Controls and Advanced Filters Toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
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
              
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                >
                  Clear All Filters
                </button>
              )}
            </div>
            
            {/* Sort Controls */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sort by:
              </label>
              <select
                value={sort}
                onChange={(e) => {
                  const newSort = e.target.value as 'name' | 'viewCount' | 'createdAt'
                  setSort(newSort)
                  updateURLParams(newSort, undefined)
                }}
                className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-1 text-sm"
              >
                <option value="name">Alphabetical</option>
                <option value="viewCount">Most Popular</option>
                <option value="createdAt">Recently Added</option>
              </select>
              <button
                onClick={() => {
                  const newOrder = order === 'asc' ? 'desc' : 'asc'
                  setOrder(newOrder)
                  updateURLParams(undefined, newOrder)
                }}
                className="px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-sm"
                title={order === 'asc' ? 'Sort ascending' : 'Sort descending'}
              >
                {order === 'asc' ? 'Ascending' : 'Descending'}
              </button>
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
                    <select
                      value={topHousing}
                      onChange={(e) => setTopHousing(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    ><option value="">Any</option>{filterOptions.topHousings.map(value => <option key={value}>{value}</option>)}</select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bottom Housing
                    </label>
                    <select
                      value={bottomHousing}
                      onChange={(e) => setBottomHousing(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    ><option value="">Any</option>{filterOptions.bottomHousings.map(value => <option key={value}>{value}</option>)}</select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Stem
                    </label>
                    <select
                      value={stem}
                      onChange={(e) => setStem(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    ><option value="">Any</option>{filterOptions.stems.map(value => <option key={value}>{value}</option>)}</select>
                  </div>
                </div>
              </div>

              {/* Colors */}
              <div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Colors</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Top Housing Color
                    </label>
                    <select
                      value={topHousingColor}
                      onChange={(e) => setTopHousingColor(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    ><option value="">Any</option>{filterOptions.topHousingColors.map(value => <option key={value}>{value}</option>)}</select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Bottom Housing Color
                    </label>
                    <select
                      value={bottomHousingColor}
                      onChange={(e) => setBottomHousingColor(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    ><option value="">Any</option>{filterOptions.bottomHousingColors.map(value => <option key={value}>{value}</option>)}</select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Stem Color
                    </label>
                    <select
                      value={stemColor}
                      onChange={(e) => setStemColor(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    ><option value="">Any</option>{filterOptions.stemColors.map(value => <option key={value}>{value}</option>)}</select>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Marking
                    </label>
                    <select
                      value={markings}
                      onChange={(e) => setMarkings(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    ><option value="">Any</option>{filterOptions.markingsList.map(value => <option key={value}>{value}</option>)}</select>
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
                    <select
                      value={springWeight}
                      onChange={(e) => setSpringWeight(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    ><option value="">Any</option>{filterOptions.springWeights.map(value => <option key={value}>{value}</option>)}</select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Spring Length
                    </label>
                    <select
                      value={springLength}
                      onChange={(e) => setSpringLength(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    ><option value="">Any</option>{filterOptions.springLengths.map(value => <option key={value}>{value}</option>)}</select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Compatibility
                    </label>
                    <select
                      value={compatibility}
                      onChange={(e) => setCompatibility(e.target.value)}
                      className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 text-sm"
                    ><option value="">Any</option>{filterOptions.compatibilities.map(value => <option key={value}>{value}</option>)}</select>
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
                      {filterOptions.magnetOrientations.map(value => <option key={value}>{value}</option>)}
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
                      {filterOptions.magnetPositions.map(value => <option key={value}>{value}</option>)}
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
                      {filterOptions.magnetPolarities.map(value => <option key={value}>{value}</option>)}
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
                      {filterOptions.pcbThicknesses.map(value => <option key={value}>{value}</option>)}
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
          {filteredSwitches.length === 0 && !loading ? (
            <div className="p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No switches found matching your criteria
              </p>
            </div>
          ) : (
            <VirtualSwitchList
              switches={filteredSwitches}
              onSwitchClick={handleSwitchClick}
              selectedForComparison={selectedForComparison}
              isComparisonMode={isComparisonMode}
            />
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
          onAddToWishlist={addToWishlist}
          onDeleteSwitch={session?.user?.role === 'ADMIN' ? deleteSwitch : undefined}
          onOpenLinkDialog={setLinkDialogSwitch}
          isAddingSwitch={addingSwitch === selectedSwitch.id}
          isAddingToWishlist={addingToWishlist === selectedSwitch.id}
          isDeletingSwitch={deletingSwitch === selectedSwitch.id}
          isAdmin={session?.user?.role === 'ADMIN'}
        />
      )}

      {/* Force Curve Comparison Modal */}
      {showComparisonModal && selectedForComparison.size > 0 && (
        <SwitchesDBComparison
          selectedSwitches={Array.from(selectedForComparison).map(id => {
            const sw = switches.find(s => s.id === id)
            return {
              id,
              name: sw?.name || '',
              manufacturer: sw?.manufacturer || null
            }
          })}
          onClose={() => {
            setShowComparisonModal(false)
            setIsComparisonMode(false)
            setSelectedForComparison(new Set())
          }}
        />
      )}
    </div>
  )
}
