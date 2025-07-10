'use client'

import { useState, useEffect } from 'react'

interface Manufacturer {
  id: string
  name: string
  aliases: string[]
  verified: boolean
  usageCount: number
  createdAt: string
  user?: {
    username: string
  }
}

export default function ManufacturerManagement() {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'verified' | 'unverified'>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', aliases: '', verified: false })
  const [mergeMode, setMergeMode] = useState(false)
  const [selectedForMerge, setSelectedForMerge] = useState<string[]>([])

  useEffect(() => {
    fetchManufacturers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter])

  const fetchManufacturers = async () => {
    try {
      const url = filter === 'all' 
        ? '/api/admin/manufacturers'
        : `/api/admin/manufacturers?verified=${filter === 'verified'}`
      
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setManufacturers(data)
      }
    } catch (error) {
      // Failed to fetch manufacturers
    } finally {
      setLoading(false)
    }
  }

  const handleEdit = (manufacturer: Manufacturer) => {
    setEditingId(manufacturer.id)
    setEditForm({
      name: manufacturer.name,
      aliases: manufacturer.aliases.join(', '),
      verified: manufacturer.verified
    })
  }

  const handleSave = async () => {
    if (!editingId) return

    try {
      const response = await fetch(`/api/admin/manufacturers/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name,
          aliases: editForm.aliases.split(',').map(a => a.trim()).filter(Boolean),
          verified: editForm.verified
        })
      })

      if (response.ok) {
        setEditingId(null)
        fetchManufacturers()
      }
    } catch (error) {
      // Failed to update manufacturer
    }
  }

  const handleDelete = async (id: string, force = false) => {
    const manufacturer = manufacturers.find(m => m.id === id)
    if (!manufacturer) return

    let confirmMessage = 'Are you sure you want to delete this manufacturer?'
    
    if (force && manufacturer.usageCount > 0) {
      confirmMessage = `⚠️ FORCE DELETE WARNING ⚠️

This will permanently delete "${manufacturer.name}" and set the manufacturer field to BLANK for ${manufacturer.usageCount} switches.

This action CANNOT be undone.

Are you absolutely sure you want to proceed?`
    }

    if (!confirm(confirmMessage)) return

    try {
      const url = force 
        ? `/api/admin/manufacturers/${id}?force=true`
        : `/api/admin/manufacturers/${id}`
        
      const response = await fetch(url, {
        method: 'DELETE'
      })

      if (response.ok) {
        const result = await response.json()
        if (result.switchesUpdated > 0) {
          alert(`Manufacturer deleted successfully. ${result.switchesUpdated} switches now have blank manufacturer field.`)
        }
        fetchManufacturers()
      } else {
        const error = await response.json()
        
        // If it's a usage error, offer force delete option
        if (error.usageCount && error.usageCount > 0) {
          const forceConfirm = confirm(
            `This manufacturer is used by ${error.usageCount} switches.\n\nWould you like to FORCE DELETE it? This will set those switches' manufacturer field to blank.`
          )
          if (forceConfirm) {
            handleDelete(id, true)
          }
        } else {
          alert(error.error || 'Failed to delete manufacturer')
        }
      }
    } catch (error) {
      // Failed to delete manufacturer
      alert('Failed to delete manufacturer. Please try again.')
    }
  }

  const handleMerge = async () => {
    if (selectedForMerge.length !== 2) {
      alert('Please select exactly 2 manufacturers to merge')
      return
    }

    const [sourceId, targetId] = selectedForMerge
    const sourceName = manufacturers.find(m => m.id === sourceId)?.name
    const targetName = manufacturers.find(m => m.id === targetId)?.name

    if (!confirm(`Merge "${sourceName}" into "${targetName}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch('/api/admin/manufacturers/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId, targetId })
      })

      if (response.ok) {
        setSelectedForMerge([])
        setMergeMode(false)
        fetchManufacturers()
        alert('Manufacturers merged successfully')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to merge manufacturers')
      }
    } catch (error) {
      // Failed to merge manufacturers
    }
  }

  const filteredManufacturers = manufacturers.filter(m => {
    if (filter === 'verified') return m.verified
    if (filter === 'unverified') return !m.verified
    return true
  })

  if (loading) {
    return <div className="text-center py-8">Loading manufacturers...</div>
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            All ({manufacturers.length})
          </button>
          <button
            onClick={() => setFilter('verified')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              filter === 'verified'
                ? 'bg-green-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Verified ({manufacturers.filter(m => m.verified).length})
          </button>
          <button
            onClick={() => setFilter('unverified')}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              filter === 'unverified'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            Unverified ({manufacturers.filter(m => !m.verified).length})
          </button>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => {
              setMergeMode(!mergeMode)
              setSelectedForMerge([])
            }}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              mergeMode
                ? 'bg-orange-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {mergeMode ? 'Cancel Merge' : 'Merge Mode'}
          </button>
          
          {mergeMode && selectedForMerge.length === 2 && (
            <button
              onClick={handleMerge}
              className="px-4 py-2 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
            >
              Merge Selected
            </button>
          )}
        </div>
      </div>

      {/* Manufacturer List */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                {mergeMode && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Select
                  </th>
                )}
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Aliases
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Usage
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Added By
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredManufacturers.map((manufacturer) => (
                <tr key={manufacturer.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  {mergeMode && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedForMerge.includes(manufacturer.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            if (selectedForMerge.length < 2) {
                              setSelectedForMerge([...selectedForMerge, manufacturer.id])
                            }
                          } else {
                            setSelectedForMerge(selectedForMerge.filter(id => id !== manufacturer.id))
                          }
                        }}
                        disabled={!selectedForMerge.includes(manufacturer.id) && selectedForMerge.length >= 2}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId === manufacturer.id ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="block w-full text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                      />
                    ) : (
                      <div className="text-sm font-medium text-gray-900 dark:text-white">
                        {manufacturer.name}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingId === manufacturer.id ? (
                      <textarea
                        value={editForm.aliases}
                        onChange={(e) => setEditForm({ ...editForm, aliases: e.target.value })}
                        className="block w-full text-sm border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        rows={2}
                        placeholder="Comma-separated aliases"
                      />
                    ) : (
                      <div className="text-sm text-gray-900 dark:text-gray-300">
                        {manufacturer.aliases.join(', ') || 'None'}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {editingId === manufacturer.id ? (
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={editForm.verified}
                          onChange={(e) => setEditForm({ ...editForm, verified: e.target.checked })}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Verified</span>
                      </label>
                    ) : (
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        manufacturer.verified
                          ? 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-200'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200'
                      }`}>
                        {manufacturer.verified ? 'Verified' : 'Pending'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {manufacturer.usageCount} switches
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-300">
                    {manufacturer.user?.username || 'System'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    {editingId === manufacturer.id ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSave}
                          className="text-green-600 hover:text-green-900"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="text-gray-600 hover:text-gray-900"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEdit(manufacturer)}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          Edit
                        </button>
                        {manufacturer.usageCount === 0 ? (
                          <button
                            onClick={() => handleDelete(manufacturer.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        ) : (
                          <button
                            onClick={() => handleDelete(manufacturer.id)}
                            className="text-red-800 hover:text-red-900 font-semibold"
                            title={`Force delete - will affect ${manufacturer.usageCount} switches`}
                          >
                            Force Delete
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {filteredManufacturers.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          No manufacturers found for the selected filter.
        </div>
      )}
    </div>
  )
}