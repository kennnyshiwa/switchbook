'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'

interface EditHistory {
  id: string
  editedAt: string
  editedBy: {
    id: string
    username: string
  }
  approvedBy?: {
    id: string
    username: string
  }
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  changedFields: string[]
  previousData: any
  newData: any
  rejectionReason?: string
}

interface MasterSwitchWithHistory {
  id: string
  name: string
  manufacturer: string
  edits: EditHistory[]
}

export default function MasterSwitchHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [switchData, setSwitchData] = useState<MasterSwitchWithHistory | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedEdit, setSelectedEdit] = useState<string | null>(null)

  useEffect(() => {
    const fetchHistory = async () => {
      if (status === 'loading') return
      
      if (!session) {
        router.push('/auth/login')
        return
      }

      try {
        const { id } = await params
        const response = await fetch(`/api/master-switches/${id}/history`)
        
        if (response.ok) {
          const data = await response.json()
          setSwitchData(data)
        } else {
          router.push('/switches/browse')
        }
      } catch (error) {
        console.error('Failed to fetch history:', error)
        router.push('/switches/browse')
      } finally {
        setLoading(false)
      }
    }

    fetchHistory()
  }, [params, session, status, router])

  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!switchData) {
    return null
  }

  const getFieldDisplayName = (field: string): string => {
    const fieldMap: { [key: string]: string } = {
      name: 'Name',
      chineseName: 'Chinese Name',
      manufacturer: 'Manufacturer',
      type: 'Type',
      technology: 'Technology',
      actuationForce: 'Actuation Force',
      bottomOutForce: 'Bottom Out Force',
      preTravel: 'Pre Travel',
      bottomOut: 'Total Travel',
      springWeight: 'Spring Force',
      springLength: 'Spring Length',
      topHousing: 'Top Housing Material',
      bottomHousing: 'Bottom Housing Material',
      stem: 'Stem Material',
      notes: 'Notes',
      compatibility: 'Compatibility',
      stemColor: 'Stem Color',
      preLubed: 'Pre-Lubed',
      releaseYear: 'Release Year',
      lifespan: 'Lifespan',
      productUrl: 'Product URL'
    }
    return fieldMap[field] || field
  }

  const renderFieldChange = (field: string, previousValue: any, newValue: any) => {
    // Handle special cases
    if (field === 'preLubed') {
      previousValue = previousValue ? 'Yes' : 'No'
      newValue = newValue ? 'Yes' : 'No'
    }

    return (
      <div key={field} className="py-2">
        <div className="font-medium text-gray-700 dark:text-gray-300">{getFieldDisplayName(field)}</div>
        <div className="grid grid-cols-2 gap-4 mt-1">
          <div className="bg-red-50 dark:bg-red-900/20 rounded p-2">
            <span className="text-xs text-red-600 dark:text-red-400">Previous</span>
            <div className="text-sm text-gray-900 dark:text-white">{previousValue || 'None'}</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 rounded p-2">
            <span className="text-xs text-green-600 dark:text-green-400">New</span>
            <div className="text-sm text-gray-900 dark:text-white">{newValue || 'None'}</div>
          </div>
        </div>
      </div>
    )
  }

  const approvedEdits = switchData.edits.filter(edit => edit.status === 'APPROVED')

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link
            href={`/switches/${switchData.id}`}
            className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 mb-4 inline-block"
          >
            ← Back to Switch Details
          </Link>
          
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Edit History: {switchData.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            by {switchData.manufacturer}
          </p>
        </div>

        {/* Edit History */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline */}
          <div className="lg:col-span-1">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Edit Timeline</h2>
            <div className="space-y-2">
              {switchData.edits.map((edit, index) => (
                <button
                  key={edit.id}
                  onClick={() => setSelectedEdit(edit.id)}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selectedEdit === edit.id
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-medium text-sm text-gray-900 dark:text-white">
                        Edit #{switchData.edits.length - index}
                      </div>
                      <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        by {edit.editedBy.username}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {formatDistanceToNow(new Date(edit.editedAt), { addSuffix: true })}
                      </div>
                    </div>
                    <div>
                      {edit.status === 'APPROVED' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200">
                          Approved
                        </span>
                      )}
                      {edit.status === 'PENDING' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200">
                          Pending
                        </span>
                      )}
                      {edit.status === 'REJECTED' && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200">
                          Rejected
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
              
              {/* Original submission */}
              <button
                onClick={() => setSelectedEdit(null)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedEdit === null
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <div className="font-medium text-sm text-gray-900 dark:text-white">Original Submission</div>
                <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Initial version
                </div>
              </button>
            </div>
          </div>

          {/* Edit Details */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
              {selectedEdit ? (
                (() => {
                  const edit = switchData.edits.find(e => e.id === selectedEdit)
                  if (!edit) return null

                  return (
                    <>
                      <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Edit Details</h2>
                      
                      {/* Metadata */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
                        <div className="grid grid-cols-2 gap-4 text-sm text-gray-900 dark:text-white">
                          <div>
                            <span className="font-medium">Edited by:</span> {edit.editedBy.username}
                          </div>
                          <div>
                            <span className="font-medium">Status:</span> {edit.status}
                          </div>
                          <div>
                            <span className="font-medium">Date:</span> {new Date(edit.editedAt).toLocaleString()}
                          </div>
                          {edit.approvedBy && (
                            <div>
                              <span className="font-medium">Approved by:</span> {edit.approvedBy.username}
                            </div>
                          )}
                        </div>
                        
                        {edit.rejectionReason && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                            <span className="font-medium text-sm text-gray-900 dark:text-white">Rejection Reason:</span>
                            <p className="text-sm text-red-600 dark:text-red-400 mt-1">{edit.rejectionReason}</p>
                          </div>
                        )}
                        
                        {edit.newData.editReason && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                            <span className="font-medium text-sm text-gray-900 dark:text-white">Edit Reason:</span>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{edit.newData.editReason}</p>
                          </div>
                        )}
                      </div>

                      {/* Changes */}
                      <h3 className="font-medium mb-3 text-gray-900 dark:text-white">Changes Made</h3>
                      <div className="space-y-3">
                        {edit.changedFields.map(field => 
                          renderFieldChange(field, edit.previousData[field], edit.newData[field])
                        )}
                      </div>
                    </>
                  )
                })()
              ) : (
                <>
                  <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Original Submission</h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    This is the original version of the switch as it was first submitted to the database.
                  </p>
                  <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
                    {approvedEdits.length > 0 
                      ? `This switch has been edited ${approvedEdits.length} time${approvedEdits.length > 1 ? 's' : ''} since its original submission.`
                      : 'No edits have been made to this switch yet.'
                    }
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}