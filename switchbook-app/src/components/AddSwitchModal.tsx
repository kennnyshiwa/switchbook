'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { switchSchema } from '@/lib/validation'
import { Switch } from '@prisma/client'
import SwitchForm from './SwitchForm'
import MasterSwitchSuggestions from './MasterSwitchSuggestions'

type SwitchFormData = z.infer<typeof switchSchema>

interface AddSwitchModalProps {
  userId: string
  onClose: () => void
  onSwitchAdded: (newSwitch: Switch) => void
}

export default function AddSwitchModal({ userId, onClose, onSwitchAdded }: AddSwitchModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFrankenswitch, setShowFrankenswitch] = useState(false)
  const [selectedMasterSwitchId, setSelectedMasterSwitchId] = useState<string | null>(null)
  const [showFromMasterBanner, setShowFromMasterBanner] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SwitchFormData>({
    resolver: zodResolver(switchSchema),
  })

  const switchName = watch('name')

  const onSubmit = async (data: SwitchFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      // Include masterSwitchId if selected from master database
      const submitData = selectedMasterSwitchId 
        ? { ...data, masterSwitchId: selectedMasterSwitchId }
        : data

      const response = await fetch('/api/switches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        throw new Error('Failed to create switch')
      }

      const newSwitch = await response.json()
      onSwitchAdded(newSwitch)
    } catch (error) {
      setError('Failed to create switch. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Add New Switch</h3>
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

          {showFromMasterBanner && (
            <div className="rounded-md bg-purple-50 dark:bg-purple-900/20 p-4 mb-4">
              <div className="flex items-center">
                <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white text-xs font-bold rounded-full mr-3">
                  M
                </span>
                <div className="flex-1">
                  <p className="text-sm text-purple-800 dark:text-purple-200 font-medium">
                    Adding from Master Database
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    This switch will be linked to the master database for automatic updates
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMasterSwitchId(null)
                    setShowFromMasterBanner(false)
                  }}
                  className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                  title="Remove master database link"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="relative">
            <SwitchForm 
              register={register} 
              errors={errors} 
              setValue={setValue} 
              watch={watch} 
              showFrankenswitch={showFrankenswitch} 
              isLinkedToMaster={!!selectedMasterSwitchId}
            />
            
            {/* Show suggestions when typing switch name */}
            {switchName && switchName.length >= 2 && !selectedMasterSwitchId && (
              <div style={{ position: 'absolute', top: '65px', left: 0, right: 0, zIndex: 50 }}>
                <MasterSwitchSuggestions
                  searchQuery={switchName}
                  setValue={setValue}
                  onSelectSwitch={(masterSwitch) => {
                    setSelectedMasterSwitchId(masterSwitch.id)
                    setShowFromMasterBanner(true)
                  }}
                />
              </div>
            )}
          </div>

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
              {isLoading ? 'Creating...' : 'Create Switch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}