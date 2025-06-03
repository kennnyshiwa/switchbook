'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { switchSchema } from '@/lib/validation'
import { Switch } from '@prisma/client'

type SwitchFormData = z.infer<typeof switchSchema>

interface AddSwitchModalProps {
  userId: string
  onClose: () => void
  onSwitchAdded: (newSwitch: Switch) => void
}

export default function AddSwitchModal({ userId, onClose, onSwitchAdded }: AddSwitchModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SwitchFormData>({
    resolver: zodResolver(switchSchema),
  })

  const onSubmit = async (data: SwitchFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/switches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
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
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Add New Switch</h3>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">Switch Name</label>
            <input
              {...register('name')}
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
              placeholder="e.g., Cherry MX Red"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Switch Type</label>
            <select
              {...register('type')}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
            >
              <option value="">Select a type</option>
              <option value="LINEAR">Linear</option>
              <option value="TACTILE">Tactile</option>
              <option value="CLICKY">Clicky</option>
              <option value="SILENT_LINEAR">Silent Linear</option>
              <option value="SILENT_TACTILE">Silent Tactile</option>
            </select>
            {errors.type && (
              <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Manufacturer</label>
            <input
              {...register('manufacturer')}
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
              placeholder="e.g., Cherry, Gateron, Kailh"
            />
            {errors.manufacturer && (
              <p className="mt-1 text-sm text-red-600">{errors.manufacturer.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Spring Weight</label>
              <input
                {...register('springWeight')}
                type="text"
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                placeholder="e.g., 45g, 62g"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Travel Distance</label>
              <input
                {...register('travel')}
                type="text"
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                placeholder="e.g., 4mm, 3.5mm"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Top Housing</label>
              <input
                {...register('topHousing')}
                type="text"
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                placeholder="e.g., PC, Nylon, POM"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Bottom Housing</label>
              <input
                {...register('bottomHousing')}
                type="text"
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                placeholder="e.g., PC, Nylon, POM"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Stem</label>
              <input
                {...register('stem')}
                type="text"
                className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
                placeholder="e.g., POM, Nylon, UHMWPE"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Image URL</label>
            <input
              {...register('imageUrl')}
              type="url"
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
              placeholder="https://example.com/switch-image.jpg"
            />
            {errors.imageUrl && (
              <p className="mt-1 text-sm text-red-600">{errors.imageUrl.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              {...register('notes')}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm px-3 py-2"
              placeholder="Any additional notes about this switch..."
            />
            {errors.notes && (
              <p className="mt-1 text-sm text-red-600">{errors.notes.message}</p>
            )}
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Creating...' : 'Create Switch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}