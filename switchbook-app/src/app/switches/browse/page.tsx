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
  bottomOutForce?: number
  preTravel?: number
  bottomOut?: number
  imageUrl?: string
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
  const [addingSwitch, setAddingSwitch] = useState<string | null>(null)
  
  // Filters
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [type, setType] = useState('')
  const [technology, setTechnology] = useState('')
  const [sort, setSort] = useState<'name' | 'viewCount' | 'createdAt'>('name')
  const [order, setOrder] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)

  // Debounce search input
  const debouncedSetSearch = useMemo(
    () => debounce((value: string) => {
      setDebouncedSearch(value)
      setPage(1)
    }, 300),
    []
  )

  useEffect(() => {
    debouncedSetSearch(search)
  }, [search, debouncedSetSearch])

  // Fetch master switches
  useEffect(() => {
    if (status === 'loading') return
    if (!session) {
      router.push('/auth/login')
      return
    }

    const fetchSwitches = async () => {
      setLoading(true)
      try {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: '50',
          ...(debouncedSearch && { search: debouncedSearch }),
          ...(manufacturer && { manufacturer }),
          ...(type && { type }),
          ...(technology && { technology }),
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
      }
    }

    fetchSwitches()
  }, [session, status, router, page, debouncedSearch, manufacturer, type, technology, sort, order])

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

  if (status === 'loading' || loading) {
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Search
              </label>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search switches..."
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Manufacturer
              </label>
              <input
                type="text"
                value={manufacturer}
                onChange={(e) => {
                  setManufacturer(e.target.value)
                  setPage(1)
                }}
                placeholder="Filter by manufacturer..."
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
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
                  setPage(1)
                }}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
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
                Sort By
              </label>
              <select
                value={`${sort}-${order}`}
                onChange={(e) => {
                  const [newSort, newOrder] = e.target.value.split('-') as [typeof sort, typeof order]
                  setSort(newSort)
                  setOrder(newOrder)
                  setPage(1)
                }}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-sm"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="viewCount-desc">Most Popular</option>
                <option value="createdAt-desc">Recently Added</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
          {switches.length === 0 ? (
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
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition-shadow"
                  >
                    {switchItem.imageUrl && (
                      <div className="relative w-full h-48 mb-4">
                        <Image
                          src={switchItem.imageUrl}
                          alt={switchItem.name}
                          fill
                          className="object-cover rounded-md"
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        />
                      </div>
                    )}
                    
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      {switchItem.name}
                      {switchItem.chineseName && (
                        <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">
                          {switchItem.chineseName}
                        </span>
                      )}
                    </h3>

                    <div className="space-y-1 text-sm text-gray-600 dark:text-gray-400 mb-4">
                      {switchItem.manufacturer && (
                        <p>Manufacturer: {switchItem.manufacturer}</p>
                      )}
                      {switchItem.type && (
                        <p>Type: {switchItem.type.replace('_', ' ')}</p>
                      )}
                      {switchItem.actuationForce && (
                        <p>Actuation: {switchItem.actuationForce}g</p>
                      )}
                      <p className="text-xs">
                        Used by {switchItem.userCount} {switchItem.userCount === 1 ? 'person' : 'people'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
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