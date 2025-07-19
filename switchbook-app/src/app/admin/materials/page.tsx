'use client'

import { useState, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import Link from 'next/link'

interface Material {
  id: string
  name: string
  active: boolean
  order: number
  createdAt: string
  updatedAt: string
}

export default function AdminMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([])
  const [newMaterialName, setNewMaterialName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    fetchMaterials()
  }, [])

  const fetchMaterials = async () => {
    try {
      const response = await fetch('/api/admin/materials')
      if (response.ok) {
        const data = await response.json()
        setMaterials(data)
      }
    } catch (error) {
      console.error('Failed to fetch materials:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMaterialName.trim()) return

    setSaving(true)
    try {
      const response = await fetch('/api/admin/materials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newMaterialName.trim() })
      })

      if (response.ok) {
        const newMaterial = await response.json()
        setMaterials([...materials, newMaterial])
        setNewMaterialName('')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create material')
      }
    } catch (error) {
      console.error('Failed to create material:', error)
      alert('Failed to create material')
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (id: string) => {
    if (!editingName.trim()) return

    setSaving(true)
    try {
      const response = await fetch(`/api/admin/materials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() })
      })

      if (response.ok) {
        setMaterials(materials.map(material => 
          material.id === id ? { ...material, name: editingName.trim() } : material
        ))
        setEditingId(null)
        setEditingName('')
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to update material')
      }
    } catch (error) {
      console.error('Failed to update material:', error)
      alert('Failed to update material')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleActive = async (id: string, active: boolean) => {
    setSaving(true)
    try {
      const response = await fetch(`/api/admin/materials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active })
      })

      if (response.ok) {
        setMaterials(materials.map(material => 
          material.id === id ? { ...material, active } : material
        ))
      }
    } catch (error) {
      console.error('Failed to update material:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this material?')) return

    setSaving(true)
    try {
      const response = await fetch(`/api/admin/materials/${id}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        setMaterials(materials.filter(material => material.id !== id))
      }
    } catch (error) {
      console.error('Failed to delete material:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return

    const items = Array.from(materials)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Update order values
    const updatedItems = items.map((item, index) => ({
      ...item,
      order: index
    }))

    setMaterials(updatedItems)

    // Update orders in database
    setSaving(true)
    try {
      await Promise.all(
        updatedItems.map(item =>
          fetch(`/api/admin/materials/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ order: item.order })
          })
        )
      )
    } catch (error) {
      console.error('Failed to update order:', error)
      // Revert on error
      fetchMaterials()
    } finally {
      setSaving(false)
    }
  }

  const activeMaterials = materials.filter(material => material.active)
  const inactiveMaterials = materials.filter(material => !material.active)
  const displayedMaterials = showInactive ? materials : activeMaterials

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded"></div>
              <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded"></div>
              <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded"></div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Link href="/admin" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center mb-4">
            ← Back to Admin
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Manage Materials</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Add, edit, and reorder material options for switches
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-6 p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Add New Material</h2>
          <form onSubmit={handleCreate} className="flex gap-3">
            <input
              type="text"
              value={newMaterialName}
              onChange={(e) => setNewMaterialName(e.target.value)}
              placeholder="Enter material name"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
              disabled={saving}
            />
            <button
              type="submit"
              disabled={saving || !newMaterialName.trim()}
              className="px-6 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Material
            </button>
          </form>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Materials ({activeMaterials.length} active{inactiveMaterials.length > 0 && `, ${inactiveMaterials.length} inactive`})
            </h2>
            {inactiveMaterials.length > 0 && (
              <button
                onClick={() => setShowInactive(!showInactive)}
                className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              >
                {showInactive ? 'Hide' : 'Show'} inactive
              </button>
            )}
          </div>

          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="materials">
              {(provided) => (
                <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                  {displayedMaterials.map((material, index) => (
                    <Draggable 
                      key={material.id} 
                      draggableId={material.id} 
                      index={index}
                      isDragDisabled={!material.active || saving}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.draggableProps}
                          className={`flex items-center justify-between p-3 rounded-md border ${
                            material.active 
                              ? snapshot.isDragging 
                                ? 'bg-gray-100 dark:bg-gray-700 border-gray-400 dark:border-gray-500' 
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                              : 'bg-gray-100 dark:bg-gray-900 border-gray-300 dark:border-gray-700 opacity-60'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            {material.active && (
                              <div {...provided.dragHandleProps} className="cursor-move">
                                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                </svg>
                              </div>
                            )}
                            {editingId === material.id ? (
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onBlur={() => handleUpdate(material.id)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleUpdate(material.id)
                                  if (e.key === 'Escape') {
                                    setEditingId(null)
                                    setEditingName('')
                                  }
                                }}
                                className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                                autoFocus
                              />
                            ) : (
                              <span className={`font-medium ${material.active ? 'text-gray-900 dark:text-gray-100' : 'text-gray-500 dark:text-gray-400'}`}>
                                {material.name}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleToggleActive(material.id, !material.active)}
                              className={`px-3 py-1 rounded text-sm ${
                                material.active
                                  ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                  : 'bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400'
                              }`}
                              disabled={saving}
                            >
                              {material.active ? 'Active' : 'Inactive'}
                            </button>
                            {material.active && (
                              <button
                                onClick={() => {
                                  setEditingId(material.id)
                                  setEditingName(material.name)
                                }}
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                disabled={saving}
                              >
                                Edit
                              </button>
                            )}
                            {!material.active && (
                              <button
                                onClick={() => handleDelete(material.id)}
                                className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                disabled={saving}
                              >
                                Delete
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>
    </div>
  )
}