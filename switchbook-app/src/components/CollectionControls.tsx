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

interface CollectionControlsProps {
  onSearchChange: (search: string) => void
  onSortChange: (sort: SortOption) => void
}

export default function CollectionControls({ onSearchChange, onSortChange }: CollectionControlsProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('recent')

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

  return (
    <div className="bg-white p-4 rounded-lg shadow mb-6">
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
              placeholder="Search by name, manufacturer, type, materials, or notes..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            />
          </div>
        </div>
        
        <div>
          <label htmlFor="sort" className="sr-only">Sort by</label>
          <select
            id="sort"
            value={sortOption}
            onChange={handleSortChange}
            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
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
            <option value="travel-asc">Travel (Low to High)</option>
            <option value="travel-desc">Travel (High to Low)</option>
          </select>
        </div>
      </div>
    </div>
  )
}