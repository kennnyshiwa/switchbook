'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { switchSchema } from '@/lib/validation'
import { Switch, ClickType } from '@prisma/client'
import SwitchForm from './SwitchForm'
import SwitchImageManager from './SwitchImageManager'

interface SwitchImage {
  id: string
  url: string
  type: 'UPLOADED' | 'LINKED'
  order: number
  caption?: string | null
  thumbnailUrl?: string
  mediumUrl?: string
}

interface ExtendedSwitch extends Switch {
  images?: SwitchImage[]
}

type SwitchFormData = z.infer<typeof switchSchema>

interface EditSwitchModalProps {
  switch: ExtendedSwitch
  onClose: () => void
  onSwitchUpdated: (updatedSwitch: ExtendedSwitch) => void
}

export default function EditSwitchModal({ switch: switchItem, onClose, onSwitchUpdated }: EditSwitchModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFrankenswitch, setShowFrankenswitch] = useState(false)
  const [syncStatus, setSyncStatus] = useState<{
    isLinkedToMaster: boolean;
    hasUpdates: boolean;
    isModified: boolean;
  } | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isSubmittingToMaster, setIsSubmittingToMaster] = useState(false)
  const [showSubmissionDialog, setShowSubmissionDialog] = useState(false)
  const [submissionNotes, setSubmissionNotes] = useState('')
  const [masterNotes, setMasterNotes] = useState('')
  const [similarSwitches, setSimilarSwitches] = useState<any[]>([])
  const [confirmNotDuplicate, setConfirmNotDuplicate] = useState(false)
  const [localImages, setLocalImages] = useState<SwitchImage[]>(switchItem.images || [])

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SwitchFormData>({
    resolver: zodResolver(switchSchema) as any,
    defaultValues: {
      name: switchItem.name,
      chineseName: switchItem.chineseName || '',
      type: switchItem.type || undefined,
      technology: switchItem.technology || undefined,
      magnetOrientation: switchItem.magnetOrientation || '',
      magnetPosition: switchItem.magnetPosition || '',
      magnetPolarity: switchItem.magnetPolarity || '',
      initialForce: switchItem.initialForce || undefined,
      initialMagneticFlux: switchItem.initialMagneticFlux || undefined,
      bottomOutMagneticFlux: switchItem.bottomOutMagneticFlux || undefined,
      pcbThickness: switchItem.pcbThickness || '',
      compatibility: switchItem.compatibility || '',
      manufacturer: switchItem.manufacturer || '',
      actuationForce: switchItem.actuationForce || undefined,
      tactileForce: switchItem.tactileForce || undefined,
      bottomOutForce: switchItem.bottomOutForce || undefined,
      progressiveSpring: switchItem.progressiveSpring || false,
      doubleStage: switchItem.doubleStage || false,
      preTravel: switchItem.preTravel || undefined,
      bottomOut: switchItem.bottomOut || undefined,
      springWeight: switchItem.springWeight || '',
      springLength: switchItem.springLength || '',
      notes: switchItem.notes || '',
      personalNotes: switchItem.personalNotes || '',
      topHousing: switchItem.topHousing || '',
      bottomHousing: switchItem.bottomHousing || '',
      stem: switchItem.stem || '',
      frankenTop: switchItem.frankenTop || '',
      frankenBottom: switchItem.frankenBottom || '',
      frankenStem: switchItem.frankenStem || '',
      clickType: switchItem.clickType || undefined,
      tactilePosition: switchItem.tactilePosition || undefined,
      dateObtained: switchItem.dateObtained ? new Date(switchItem.dateObtained).toISOString().split('T')[0] : '',
      personalTags: switchItem.personalTags || [],
      topHousingColor: switchItem.topHousingColor || '',
      bottomHousingColor: switchItem.bottomHousingColor || '',
      stemColor: switchItem.stemColor || '',
      stemShape: switchItem.stemShape || '',
      markings: switchItem.markings || '',
    }
  })

  // Check if Frankenswitch should be enabled on load
  useEffect(() => {
    if (switchItem.frankenTop || switchItem.frankenBottom || switchItem.frankenStem) {
      setShowFrankenswitch(true)
    }
    // Update local images when switch prop changes
    setLocalImages(switchItem.images || [])
  }, [switchItem])

  // Check sync status on mount
  useEffect(() => {
    const checkSyncStatus = async () => {
      try {
        const response = await fetch(`/api/switches/${switchItem.id}/sync-master`)
        if (response.ok) {
          const data = await response.json()
          setSyncStatus(data)
        }
      } catch (error) {
        // Failed to check sync status
      }
    }
    checkSyncStatus()
  }, [switchItem.id])

  const handleSyncWithMaster = async () => {
    if (!confirm('This will reset all switch details to match the master database. Any custom changes will be lost. Continue?')) {
      return
    }

    setIsSyncing(true)
    setError(null)
    
    try {
      const response = await fetch(`/api/switches/${switchItem.id}/sync-master`, {
        method: 'POST',
      })

      if (!response.ok) {
        throw new Error('Failed to sync with master')
      }

      const data = await response.json()
      const syncedSwitch = data.switch
      
      // Update all form fields with the synced data
      setValue('name', syncedSwitch.name)
      setValue('chineseName', syncedSwitch.chineseName || '')
      setValue('type', syncedSwitch.type || undefined)
      setValue('technology', syncedSwitch.technology || undefined)
      setValue('magnetOrientation', syncedSwitch.magnetOrientation || '')
      setValue('magnetPosition', syncedSwitch.magnetPosition || '')
      setValue('magnetPolarity', syncedSwitch.magnetPolarity || '')
      setValue('initialForce', syncedSwitch.initialForce || undefined)
      setValue('initialMagneticFlux', syncedSwitch.initialMagneticFlux || undefined)
      setValue('bottomOutMagneticFlux', syncedSwitch.bottomOutMagneticFlux || undefined)
      setValue('pcbThickness', syncedSwitch.pcbThickness || '')
      setValue('compatibility', syncedSwitch.compatibility || '')
      setValue('manufacturer', syncedSwitch.manufacturer || '')
      setValue('actuationForce', syncedSwitch.actuationForce || undefined)
      setValue('tactileForce', syncedSwitch.tactileForce || undefined)
      setValue('tactilePosition', syncedSwitch.tactilePosition || undefined)
      setValue('bottomOutForce', syncedSwitch.bottomOutForce || undefined)
      setValue('progressiveSpring', syncedSwitch.progressiveSpring || false)
      setValue('doubleStage', syncedSwitch.doubleStage || false)
      setValue('preTravel', syncedSwitch.preTravel || undefined)
      setValue('bottomOut', syncedSwitch.bottomOut || undefined)
      setValue('springWeight', syncedSwitch.springWeight || '')
      setValue('springLength', syncedSwitch.springLength || '')
      setValue('notes', syncedSwitch.notes || '')
      // Keep personalNotes and personalTags unchanged - they're user-specific
      setValue('topHousing', syncedSwitch.topHousing || '')
      setValue('bottomHousing', syncedSwitch.bottomHousing || '')
      setValue('stem', syncedSwitch.stem || '')
      setValue('frankenTop', syncedSwitch.frankenTop || '')
      setValue('frankenBottom', syncedSwitch.frankenBottom || '')
      setValue('frankenStem', syncedSwitch.frankenStem || '')
      setValue('clickType', syncedSwitch.clickType || undefined)
      setValue('dateObtained', syncedSwitch.dateObtained ? new Date(syncedSwitch.dateObtained).toISOString().split('T')[0] : '')
      setValue('topHousingColor', syncedSwitch.topHousingColor || '')
      setValue('bottomHousingColor', syncedSwitch.bottomHousingColor || '')
      setValue('stemColor', syncedSwitch.stemColor || '')
      setValue('stemShape', syncedSwitch.stemShape || '')
      setValue('markings', syncedSwitch.markings || '')
      
      // Preserve local images when syncing - check if API returned images
      const updatedSwitch = syncedSwitch.images ? syncedSwitch : { ...syncedSwitch, images: localImages }
      onSwitchUpdated(updatedSwitch)
      setSyncStatus(prev => prev ? { ...prev, hasUpdates: false, isModified: false } : null)
    } catch (error) {
      setError('Failed to sync with master database. Please try again.')
    } finally {
      setIsSyncing(false)
    }
  }

  const onSubmit = async (data: SwitchFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/switches/${switchItem.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to update switch')
      }

      const updatedSwitch = await response.json()
      // Include the current local images in the updated switch data
      onSwitchUpdated({ ...updatedSwitch, images: localImages })
      
      // Refresh sync status after update
      const syncResponse = await fetch(`/api/switches/${switchItem.id}/sync-master`)
      if (syncResponse.ok) {
        const syncData = await syncResponse.json()
        setSyncStatus(syncData)
      }
      
      // Close the modal after successful update
      onClose()
    } catch (error) {
      setError('Failed to update switch. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmitToMaster = async () => {
    if (submissionNotes.length < 10) {
      setError('Please provide submission notes (at least 10 characters) explaining what makes this switch unique or why it should be added to the master database.')
      return
    }

    setIsSubmittingToMaster(true)
    setError(null)

    try {
      const currentData = watch()
      
      // If this is the first time linking and there are existing notes, move them to personalNotes first
      if (!switchItem.masterSwitchId && currentData.notes) {
        const currentPersonalNotes = currentData.personalNotes || ''
        const notesToMove = currentData.notes
        
        // Create a simplified update that only touches the notes fields
        const notesUpdate = {
          notes: '', // Clear notes field
          personalNotes: currentPersonalNotes ? `${currentPersonalNotes}\n\n${notesToMove}` : notesToMove
        }
        
        const moveNotesResponse = await fetch(`/api/switches/${switchItem.id}/update-notes`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notesUpdate)
        })
        
        if (!moveNotesResponse.ok) {
          const errorText = await moveNotesResponse.text()
          // Failed to preserve personal notes
          throw new Error('Failed to preserve personal notes')
        }
        
        // Update the form to reflect this change
        setValue('notes', '')
        setValue('personalNotes', notesUpdate.personalNotes)
      }
      
      // Find the first externally linked image if available
      const linkedImage = localImages.find(img => img.type === 'LINKED')
      const imageUrl = linkedImage ? linkedImage.url : null
      
      const submissionData = {
        name: currentData.name,
        chineseName: currentData.chineseName || null,
        manufacturer: currentData.manufacturer,
        type: currentData.type || null,
        technology: currentData.technology || null,
        compatibility: currentData.compatibility || null,
        initialForce: currentData.initialForce || null,
        actuationForce: currentData.actuationForce || null,
        tactileForce: currentData.tactileForce || null,
        tactilePosition: currentData.tactilePosition || null,
        bottomOutForce: currentData.bottomOutForce || null,
        preTravel: currentData.preTravel || null,
        bottomOut: currentData.bottomOut || null,
        springWeight: currentData.springWeight || null,
        springLength: currentData.springLength || null,
        progressiveSpring: currentData.progressiveSpring || null,
        doubleStage: currentData.doubleStage || null,
        topHousing: currentData.topHousing || null,
        bottomHousing: currentData.bottomHousing || null,
        stem: currentData.stem || null,
        magnetOrientation: currentData.magnetOrientation || null,
        magnetPosition: currentData.magnetPosition || null,
        magnetPolarity: currentData.magnetPolarity || null,
        initialMagneticFlux: currentData.initialMagneticFlux || null,
        bottomOutMagneticFlux: currentData.bottomOutMagneticFlux || null,
        pcbThickness: currentData.pcbThickness || null,
        clickType: currentData.clickType || null,
        topHousingColor: currentData.topHousingColor || null,
        bottomHousingColor: currentData.bottomHousingColor || null,
        stemColor: currentData.stemColor || null,
        stemShape: currentData.stemShape || null,
        markings: currentData.markings || null,
        notes: masterNotes || null,
        submissionNotes: submissionNotes,
        confirmNotDuplicate: confirmNotDuplicate,
        sourceSwitchId: switchItem.id,  // Include the source switch ID
        imageUrl: imageUrl  // Include the external image URL if available
      }

      const response = await fetch('/api/master-switches/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submissionData),
      })

      const data = await response.json()

      if (response.status === 409 && data.similarSwitches) {
        // Similar switches found, show them to the user
        setSimilarSwitches(data.similarSwitches)
        setConfirmNotDuplicate(true)
        return
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit to master database')
      }

      // Success
      setShowSubmissionDialog(false)
      setSubmissionNotes('')
      setMasterNotes('')
      setSimilarSwitches([])
      setConfirmNotDuplicate(false)
      
      // If the switch was linked, update the local state to reflect this
      if (data.linkedSwitch) {
        // The master switch was successfully created and linked
        // Now we need to sync with the master to get the master notes
        const syncResponse = await fetch(`/api/switches/${switchItem.id}/sync-master`, {
          method: 'POST'
        })
        
        if (syncResponse.ok) {
          const syncData = await syncResponse.json()
          // Update with the synced data but preserve local images if API doesn't include them
          const updatedSwitch = syncData.switch.images ? syncData.switch : { ...syncData.switch, images: localImages }
          onSwitchUpdated(updatedSwitch)
          
          // Update form to reflect the synced data
          setValue('notes', syncData.switch.notes || '')
          // personalNotes should already be set from the earlier update
        }
        
        // Refresh sync status
        const statusResponse = await fetch(`/api/switches/${switchItem.id}/sync-master`)
        if (statusResponse.ok) {
          const statusData = await statusResponse.json()
          setSyncStatus(statusData)
        }
      }
      
      const message = data.linkedSwitch 
        ? 'Switch submitted successfully! It will be reviewed by an admin before being added to the master database. Your switch has been automatically linked to the submission.'
        : 'Switch submitted successfully! It will be reviewed by an admin before being added to the master database.'
      
      alert(message)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to submit to master database. Please try again.')
    } finally {
      setIsSubmittingToMaster(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Edit Switch</h3>
          <div className="flex items-center space-x-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showFrankenswitch}
                onChange={(e) => setShowFrankenswitch(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Frankenswitch</span>
            </label>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          {/* Sync Status Banner */}
          {syncStatus?.isLinkedToMaster && (
            <div className={`rounded-md p-4 ${
              syncStatus.hasUpdates 
                ? 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800' 
                : syncStatus.isModified
                ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
            }`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  {syncStatus.hasUpdates ? (
                    <>
                      <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                        Master Database Updated
                      </h4>
                      <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                        The master switch has been updated. You can sync to get the latest details.
                      </p>
                    </>
                  ) : syncStatus.isModified ? (
                    <>
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                        Customized Switch
                      </h4>
                      <p className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                        This switch has been customized from the master database version.
                      </p>
                    </>
                  ) : (
                    <>
                      <h4 className="text-sm font-medium text-green-800 dark:text-green-200">
                        Synced with Master
                      </h4>
                      <p className="mt-1 text-sm text-green-700 dark:text-green-300">
                        This switch is up to date with the master database.
                      </p>
                    </>
                  )}
                </div>
                {(syncStatus.hasUpdates || syncStatus.isModified) && (
                  <button
                    type="button"
                    onClick={handleSyncWithMaster}
                    disabled={isSyncing}
                    className="ml-4 px-3 py-1.5 text-sm font-medium text-white bg-purple-600 rounded-md hover:bg-purple-700 disabled:opacity-50"
                  >
                    {isSyncing ? 'Syncing...' : 'Reset to Master'}
                  </button>
                )}
              </div>
            </div>
          )}

          <SwitchForm 
            register={register} 
            errors={errors} 
            setValue={setValue} 
            watch={watch} 
            showFrankenswitch={showFrankenswitch} 
            isLinkedToMaster={!!switchItem.masterSwitchId}
          />

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-transparent rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? 'Updating...' : 'Update Switch'}
            </button>
            {!switchItem.masterSwitchId && (
              <button
                type="button"
                onClick={() => setShowSubmissionDialog(true)}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 dark:bg-purple-500 border border-transparent rounded-md hover:bg-purple-700 dark:hover:bg-purple-600 disabled:opacity-50"
              >
                Submit to Master DB
              </button>
            )}
          </div>
        </form>

        {/* Image Manager Section */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Images</h3>
          <SwitchImageManager
            switchId={switchItem.id}
            images={localImages}
            onImagesUpdated={(images) => {
              // Only update local state, don't close the modal
              setLocalImages(images)
            }}
          />
        </div>
      </div>

      {/* Submit to Master DB Dialog */}
      {showSubmissionDialog && (
        <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-80 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Submit to Master Database</h3>
            </div>
            
            <div className="p-6 space-y-4">
              {error && (
                <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
                  <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
                </div>
              )}

              {similarSwitches.length > 0 && (
                <div className="rounded-md bg-yellow-50 dark:bg-yellow-900/20 p-4">
                  <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                    Similar switches found:
                  </h4>
                  <ul className="space-y-1 text-sm text-yellow-700 dark:text-yellow-300">
                    {similarSwitches.map((sw) => (
                      <li key={sw.id}>
                        {sw.name} by {sw.manufacturer} ({Math.round(sw.similarity * 100)}% similar)
                      </li>
                    ))}
                  </ul>
                  <p className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                    Please confirm this is not a duplicate switch.
                  </p>
                </div>
              )}

              <div>
                <label htmlFor="masterNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Master Switch Notes (optional)
                </label>
                <textarea
                  id="masterNotes"
                  value={masterNotes}
                  onChange={(e) => setMasterNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Add any notes about this switch that should be included in the master database..."
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  These notes will be visible to all users in the master database
                </p>
              </div>

              <div>
                <label htmlFor="submissionNotes" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Submission Notes (required)
                </label>
                <textarea
                  id="submissionNotes"
                  value={submissionNotes}
                  onChange={(e) => setSubmissionNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-gray-100"
                  placeholder="Explain what makes this switch unique or why it should be added to the master database..."
                />
                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                  Minimum 10 characters required
                </p>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowSubmissionDialog(false)
                  setSubmissionNotes('')
                  setMasterNotes('')
                  setSimilarSwitches([])
                  setConfirmNotDuplicate(false)
                  setError(null)
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSubmitToMaster}
                disabled={isSubmittingToMaster || submissionNotes.length < 10}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 dark:bg-purple-500 border border-transparent rounded-md hover:bg-purple-700 dark:hover:bg-purple-600 disabled:opacity-50"
              >
                {isSubmittingToMaster ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}