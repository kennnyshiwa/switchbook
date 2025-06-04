'use client'

import { useState, useMemo } from 'react'
import { Switch } from '@prisma/client'
import SwitchCard from './SwitchCard'
import SwitchTable from './SwitchTable'
import AddSwitchModal from './AddSwitchModal'
import EditSwitchModal from './EditSwitchModal'
import CollectionControls, { SortOption, ViewMode } from './CollectionControls'

interface SwitchCollectionProps {
  switches: Switch[]
  userId: string
}

export default function SwitchCollection({ switches: initialSwitches, userId }: SwitchCollectionProps) {
  const [switches, setSwitches] = useState(initialSwitches)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingSwitch, setEditingSwitch] = useState<Switch | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortOption, setSortOption] = useState<SortOption>('recent')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

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

  const filteredAndSortedSwitches = useMemo(() => {
    let filtered = switches

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase()
      filtered = switches.filter(s => 
        s.name.toLowerCase().includes(search) ||
        s.manufacturer.toLowerCase().includes(search) ||
        s.type.toLowerCase().includes(search) ||
        (s.notes?.toLowerCase().includes(search) ?? false) ||
        (s.springWeight?.toLowerCase().includes(search) ?? false) ||
        (s.topHousing?.toLowerCase().includes(search) ?? false) ||
        (s.bottomHousing?.toLowerCase().includes(search) ?? false) ||
        (s.stem?.toLowerCase().includes(search) ?? false)
      )
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
        sorted.sort((a, b) => a.manufacturer.localeCompare(b.manufacturer))
        break
      case 'manufacturer-desc':
        sorted.sort((a, b) => b.manufacturer.localeCompare(a.manufacturer))
        break
      case 'type':
        sorted.sort((a, b) => a.type.localeCompare(b.type))
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

    return sorted
  }, [switches, searchTerm, sortOption])

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
            <div className="mt-6">
              <button
                onClick={() => setShowAddModal(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
              >
                Add your first switch
              </button>
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
          <h2 className="text-xl font-semibold text-gray-900">
            Your Switches ({switches.length}{searchTerm && ` • ${filteredAndSortedSwitches.length} shown`})
          </h2>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
          >
            Add Switch
          </button>
        </div>
        <CollectionControls
          onSearchChange={setSearchTerm}
          onSortChange={setSortOption}
          onViewChange={setViewMode}
          currentView={viewMode}
        />
      </div>
      
      {filteredAndSortedSwitches.length === 0 && searchTerm ? (
        <div className="text-center py-12">
          <p className="text-gray-500">No switches found matching &quot;{searchTerm}&quot;</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAndSortedSwitches.map((switchItem) => (
            <SwitchCard
              key={switchItem.id}
              switch={switchItem}
              onDelete={handleSwitchDeleted}
              onEdit={setEditingSwitch}
            />
          ))}
        </div>
      ) : (
        <SwitchTable
          switches={filteredAndSortedSwitches}
          onDelete={handleSwitchDeleted}
          onEdit={setEditingSwitch}
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