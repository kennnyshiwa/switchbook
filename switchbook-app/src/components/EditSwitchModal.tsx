'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { switchSchema } from '@/lib/validation'
import { Switch } from '@prisma/client'
import SwitchForm from './SwitchForm'

type SwitchFormData = z.infer<typeof switchSchema>

interface EditSwitchModalProps {
  switch: Switch
  onClose: () => void
  onSwitchUpdated: (updatedSwitch: Switch) => void
}

export default function EditSwitchModal({ switch: switchItem, onClose, onSwitchUpdated }: EditSwitchModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      initialForce: switchItem.initialForce || undefined,
      totalTravel: switchItem.totalTravel || undefined,
      initialMagneticFlux: switchItem.initialMagneticFlux || undefined,
      bottomOutMagneticFlux: switchItem.bottomOutMagneticFlux || undefined,
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
      topHousing: switchItem.topHousing || '',
      bottomHousing: switchItem.bottomHousing || '',
      stem: switchItem.stem || '',
      dateObtained: switchItem.dateObtained ? new Date(switchItem.dateObtained).toISOString().split('T')[0] : '',
    }
  })

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
    } catch (error) {
      setError('Failed to update switch. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Edit Switch</h3>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          <SwitchForm register={register} errors={errors} setValue={setValue} watch={watch} />

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
      </div>
    </div>
  )
}