'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { switchSchema } from '@/lib/validation'
import { Switch } from '@prisma/client'
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

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SwitchFormData>({
    resolver: zodResolver(switchSchema),
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
      bottomOutForce: switchItem.bottomOutForce || undefined,
      preTravel: switchItem.preTravel || undefined,
      bottomOut: switchItem.bottomOut || undefined,
      springWeight: switchItem.springWeight || '',
      springLength: switchItem.springLength || '',
      imageUrl: switchItem.imageUrl || '',
      notes: switchItem.notes || '',
      personalNotes: switchItem.personalNotes || '',
      topHousing: switchItem.topHousing || '',
      bottomHousing: switchItem.bottomHousing || '',
      stem: switchItem.stem || '',
      frankenTop: switchItem.frankenTop || '',
      frankenBottom: switchItem.frankenBottom || '',
      frankenStem: switchItem.frankenStem || '',
      dateObtained: switchItem.dateObtained ? new Date(switchItem.dateObtained).toISOString().split('T')[0] : '',
    }
  })

  // Check if Frankenswitch should be enabled on load
  useEffect(() => {
    if (switchItem.frankenTop || switchItem.frankenBottom || switchItem.frankenStem) {
      setShowFrankenswitch(true)
    }
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
        console.error('Failed to check sync status:', error)
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
      onSwitchUpdated(data.switch)
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
      onSwitchUpdated(updatedSwitch)
      
      // Refresh sync status after update
      const syncResponse = await fetch(`/api/switches/${switchItem.id}/sync-master`)
      if (syncResponse.ok) {
        const syncData = await syncResponse.json()
        setSyncStatus(syncData)
      }
    } catch (error) {
      setError('Failed to update switch. Please try again.')
    } finally {
      setIsLoading(false)
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
          </div>
        </form>

        {/* Image Manager Section */}
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Images</h3>
          <SwitchImageManager
            switchId={switchItem.id}
            images={switchItem.images || []}
            onImagesUpdated={(images) => {
              // Update the switch with new images
              onSwitchUpdated({ ...switchItem, images })
            }}
          />
        </div>
      </div>
    </div>
  )
}