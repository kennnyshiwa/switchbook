'use client'

import { useState } from 'react'

export type SortOption = 
  | 'recent' 
  | 'oldest' 
  | 'name-asc' 
  | 'name-desc' 
  | 'manufacturer-asc' 
  | 'manufacturer-desc'
  | 'spring-asc' 
  | 'spring-desc'
  | 'type'
  | 'travel-asc'
  | 'travel-desc'

export type ViewMode = 'grid' | 'table'

export interface FilterOptions {
  manufacturers: string[]
  types: string[]
  technologies: string[]
  topHousings: string[]
  bottomHousings: string[]
  stems: string[]
  springWeights: string[]
  springLengths: string[]
  magnetOrientations: string[]
  magnetPositions: string[]
  magnetPolarities: string[]
  pcbThicknesses: string[]
  compatibilities: string[]
  actuationForces: number[]
  tactileForces: number[]
  bottomOutForces: number[]
  preTravels: number[]
  bottomOuts: number[]
  initialForces: number[]
  initialMagneticFluxes: number[]
  bottomOutMagneticFluxes: number[]
  progressiveSprings: boolean[]
  doubleStages: boolean[]
}

export interface ActiveFilters {
  manufacturer?: string
  type?: string
  technology?: string
  topHousing?: string
  bottomHousing?: string
  stem?: string
  springWeight?: string
  springLength?: string
  magnetOrientation?: string
  magnetPosition?: string
  magnetPolarity?: string
  pcbThickness?: string
  compatibility?: string
  actuationForceMin?: number
  actuationForceMax?: number
  tactileForceMin?: number
  tactileForceMax?: number
  bottomOutForceMin?: number
  bottomOutForceMax?: number
  progressiveSpring?: boolean
  doubleStage?: boolean
  preTravelMin?: number
  preTravelMax?: number
  bottomOutMin?: number
  bottomOutMax?: number
  initialForceMin?: number
  initialForceMax?: number
  initialMagneticFluxMin?: number
  initialMagneticFluxMax?: number
  bottomOutMagneticFluxMin?: number
  bottomOutMagneticFluxMax?: number
  hasForceCurves?: boolean
}

interface CollectionControlsProps {
  onSearchChange: (search: string) => void
  onSortChange: (sort: SortOption) => void
  onViewChange: (view: ViewMode) => void
  onFiltersChange: (filters: ActiveFilters) => void
  currentView: ViewMode
  filterOptions: FilterOptions
}

export default function CollectionControls({ 
  onSearchChange, 
  onSortChange, 
  onViewChange, 
  onFiltersChange,
  currentView, 
  filterOptions 
}: CollectionControlsProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('recent')
  const [activeFilters, setActiveFilters] = useState<ActiveFilters>({})
  const [showFilters, setShowFilters] = useState(false)

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setSearchTerm(value)
    onSearchChange(value)
  }

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as SortOption
    setSortOption(value)
    onSortChange(value)
  }

  const handleFilterChange = (field: keyof ActiveFilters, value: string) => {
    let processedValue: string | boolean | undefined = value === '' ? undefined : value
    
    // Handle boolean fields
    if (field === 'hasForceCurves' || field === 'progressiveSpring' || field === 'doubleStage') {
      processedValue = value === '' ? undefined : value === 'true'
    }
    
    const newFilters = {
      ...activeFilters,
      [field]: processedValue
    }
    setActiveFilters(newFilters)
    onFiltersChange(newFilters)
  }

  const clearAllFilters = () => {
    const emptyFilters: ActiveFilters = {}
    setActiveFilters(emptyFilters)
    onFiltersChange(emptyFilters)
  }

  const activeFilterCount = Object.values(activeFilters).filter(Boolean).length

  const handleNumericRangeChange = (field: string, type: 'min' | 'max', value: string) => {
    const numValue = value === '' ? undefined : parseFloat(value)
    const minField = `${field}Min` as keyof ActiveFilters
    const maxField = `${field}Max` as keyof ActiveFilters
    
    const newFilters = {
      ...activeFilters,
      [type === 'min' ? minField : maxField]: numValue
    }
    setActiveFilters(newFilters)
    onFiltersChange(newFilters)
  }

  return (
    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="search" className="sr-only">Search switches</label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              id="search"
              value={searchTerm}
              onChange={handleSearchChange}
              placeholder="Search by name, manufacturer, type, technology, materials, specs, or notes..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-3 py-2 text-sm font-medium rounded-md border transition-colors ${
              showFilters
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
            }`}
          >
            <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
            </svg>
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>

          <div className="bg-gray-100 dark:bg-gray-700 p-1 rounded-lg flex">
            <button
              onClick={() => onViewChange('grid')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentView === 'grid'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="Grid view"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zM12 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1V4zM12 13a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1h-3a1 1 0 01-1-1v-3z" clipRule="evenodd" />
              </svg>
            </button>
            <button
              onClick={() => onViewChange('table')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                currentView === 'table'
                  ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
              }`}
              title="Table view"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2zM3 16a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1v-2z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
          
          <div>
            <label htmlFor="sort" className="sr-only">Sort by</label>
            <select
              id="sort"
              value={sortOption}
              onChange={handleSortChange}
              className="block w-full pl-3 pr-10 py-2 text-sm font-medium border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md h-10"
            >
              <option value="recent">Most Recent</option>
              <option value="oldest">Oldest First</option>
              <option value="name-asc">Name (A-Z)</option>
              <option value="name-desc">Name (Z-A)</option>
              <option value="manufacturer-asc">Manufacturer (A-Z)</option>
              <option value="manufacturer-desc">Manufacturer (Z-A)</option>
              <option value="type">Type</option>
              <option value="spring-asc">Spring Weight (Low to High)</option>
              <option value="spring-desc">Spring Weight (High to Low)</option>
            </select>
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Manufacturer
              </label>
              <select
                value={activeFilters.manufacturer || ''}
                onChange={(e) => handleFilterChange('manufacturer', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All Manufacturers</option>
                {filterOptions.manufacturers.map(manufacturer => (
                  <option key={manufacturer} value={manufacturer}>
                    {manufacturer}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Type
              </label>
              <select
                value={activeFilters.type || ''}
                onChange={(e) => handleFilterChange('type', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All Types</option>
                {filterOptions.types.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Technology
              </label>
              <select
                value={activeFilters.technology || ''}
                onChange={(e) => handleFilterChange('technology', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All Technologies</option>
                {filterOptions.technologies.map(technology => (
                  <option key={technology} value={technology}>
                    {technology}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Spring Weight
              </label>
              <select
                value={activeFilters.springWeight || ''}
                onChange={(e) => handleFilterChange('springWeight', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All Spring Weights</option>
                {filterOptions.springWeights.map(weight => (
                  <option key={weight} value={weight}>
                    {weight}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Top Housing
              </label>
              <select
                value={activeFilters.topHousing || ''}
                onChange={(e) => handleFilterChange('topHousing', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All Top Housings</option>
                {filterOptions.topHousings.map(housing => (
                  <option key={housing} value={housing}>
                    {housing}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bottom Housing
              </label>
              <select
                value={activeFilters.bottomHousing || ''}
                onChange={(e) => handleFilterChange('bottomHousing', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All Bottom Housings</option>
                {filterOptions.bottomHousings.map(housing => (
                  <option key={housing} value={housing}>
                    {housing}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Stem
              </label>
              <select
                value={activeFilters.stem || ''}
                onChange={(e) => handleFilterChange('stem', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All Stems</option>
                {filterOptions.stems.map(stem => (
                  <option key={stem} value={stem}>
                    {stem}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Spring Length
              </label>
              <select
                value={activeFilters.springLength || ''}
                onChange={(e) => handleFilterChange('springLength', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All Spring Lengths</option>
                {filterOptions.springLengths.map(length => (
                  <option key={length} value={length}>
                    {length}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Progressive Spring
              </label>
              <select
                value={activeFilters.progressiveSpring === undefined ? '' : activeFilters.progressiveSpring ? 'true' : 'false'}
                onChange={(e) => handleFilterChange('progressiveSpring', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Double Stage
              </label>
              <select
                value={activeFilters.doubleStage === undefined ? '' : activeFilters.doubleStage ? 'true' : 'false'}
                onChange={(e) => handleFilterChange('doubleStage', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Magnet Orientation
              </label>
              <select
                value={activeFilters.magnetOrientation || ''}
                onChange={(e) => handleFilterChange('magnetOrientation', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All Magnet Orientations</option>
                {filterOptions.magnetOrientations.map(orientation => (
                  <option key={orientation} value={orientation}>
                    {orientation}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Magnet Position
              </label>
              <select
                value={activeFilters.magnetPosition || ''}
                onChange={(e) => handleFilterChange('magnetPosition', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All Magnet Positions</option>
                {filterOptions.magnetPositions.map(position => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Magnet Polarity
              </label>
              <select
                value={activeFilters.magnetPolarity || ''}
                onChange={(e) => handleFilterChange('magnetPolarity', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All Magnet Polarities</option>
                {filterOptions.magnetPolarities.map(polarity => (
                  <option key={polarity} value={polarity}>
                    {polarity}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                PCB Thickness
              </label>
              <select
                value={activeFilters.pcbThickness || ''}
                onChange={(e) => handleFilterChange('pcbThickness', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All PCB Thicknesses</option>
                {filterOptions.pcbThicknesses.map(thickness => (
                  <option key={thickness} value={thickness}>
                    {thickness}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Compatibility
              </label>
              <select
                value={activeFilters.compatibility || ''}
                onChange={(e) => handleFilterChange('compatibility', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All Compatibilities</option>
                {filterOptions.compatibilities.map(compatibility => (
                  <option key={compatibility} value={compatibility}>
                    {compatibility}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Actuation Force (g)
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  placeholder="Min"
                  value={activeFilters.actuationForceMin || ''}
                  onChange={(e) => handleNumericRangeChange('actuationForce', 'min', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={activeFilters.actuationForceMax || ''}
                  onChange={(e) => handleNumericRangeChange('actuationForce', 'max', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
              </div>
            </div>

            {(activeFilters.type === 'TACTILE' || activeFilters.type === 'SILENT_TACTILE') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Tactile Force (g)
                </label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    placeholder="Min"
                    value={activeFilters.tactileForceMin || ''}
                    onChange={(e) => handleNumericRangeChange('tactileForce', 'min', e.target.value)}
                    className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                  />
                  <input
                    type="number"
                    placeholder="Max"
                    value={activeFilters.tactileForceMax || ''}
                    onChange={(e) => handleNumericRangeChange('tactileForce', 'max', e.target.value)}
                    className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bottom Out Force (g)
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  placeholder="Min"
                  value={activeFilters.bottomOutForceMin || ''}
                  onChange={(e) => handleNumericRangeChange('bottomOutForce', 'min', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={activeFilters.bottomOutForceMax || ''}
                  onChange={(e) => handleNumericRangeChange('bottomOutForce', 'max', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Pre Travel (mm)
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.1"
                  placeholder="Min"
                  value={activeFilters.preTravelMin || ''}
                  onChange={(e) => handleNumericRangeChange('preTravel', 'min', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Max"
                  value={activeFilters.preTravelMax || ''}
                  onChange={(e) => handleNumericRangeChange('preTravel', 'max', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bottom Out (mm)
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.1"
                  placeholder="Min"
                  value={activeFilters.bottomOutMin || ''}
                  onChange={(e) => handleNumericRangeChange('bottomOut', 'min', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Max"
                  value={activeFilters.bottomOutMax || ''}
                  onChange={(e) => handleNumericRangeChange('bottomOut', 'max', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Initial Force (g)
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  placeholder="Min"
                  value={activeFilters.initialForceMin || ''}
                  onChange={(e) => handleNumericRangeChange('initialForce', 'min', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
                <input
                  type="number"
                  placeholder="Max"
                  value={activeFilters.initialForceMax || ''}
                  onChange={(e) => handleNumericRangeChange('initialForce', 'max', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Initial Magnetic Flux (Gs)
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.1"
                  placeholder="Min"
                  value={activeFilters.initialMagneticFluxMin || ''}
                  onChange={(e) => handleNumericRangeChange('initialMagneticFlux', 'min', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Max"
                  value={activeFilters.initialMagneticFluxMax || ''}
                  onChange={(e) => handleNumericRangeChange('initialMagneticFlux', 'max', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bottom Out Magnetic Flux (Gs)
              </label>
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.1"
                  placeholder="Min"
                  value={activeFilters.bottomOutMagneticFluxMin || ''}
                  onChange={(e) => handleNumericRangeChange('bottomOutMagneticFlux', 'min', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
                <input
                  type="number"
                  step="0.1"
                  placeholder="Max"
                  value={activeFilters.bottomOutMagneticFluxMax || ''}
                  onChange={(e) => handleNumericRangeChange('bottomOutMagneticFlux', 'max', e.target.value)}
                  className="block w-full pl-3 pr-2 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Force Curves
              </label>
              <select
                value={activeFilters.hasForceCurves === undefined ? '' : activeFilters.hasForceCurves ? 'true' : 'false'}
                onChange={(e) => handleFilterChange('hasForceCurves', e.target.value)}
                className="block w-full pl-3 pr-8 py-2 text-sm border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 rounded-md"
              >
                <option value="">All Switches</option>
                <option value="true">With Force Curves</option>
                <option value="false">Without Force Curves</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={clearAllFilters}
                disabled={activeFilterCount === 0}
                className="w-full px-3 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Clear All Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}