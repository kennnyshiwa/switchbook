'use client'

import { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form'
import { z } from 'zod'
import { switchSchema } from '@/lib/validation'
import ManufacturerAutocomplete from './ManufacturerAutocomplete'

type SwitchFormData = z.infer<typeof switchSchema>

interface SwitchFormProps {
  register: UseFormRegister<SwitchFormData>
  errors: FieldErrors<SwitchFormData>
  defaultValues?: Partial<SwitchFormData>
  setValue: UseFormSetValue<SwitchFormData>
  watch: UseFormWatch<SwitchFormData>
}

export default function SwitchForm({ register, errors, setValue, watch }: SwitchFormProps) {
  const manufacturerValue = watch('manufacturer')
  const technologyValue = watch('technology')
  const showMagneticFields = technologyValue === 'MAGNETIC'
  
  return (
    <>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Switch Name</label>
        <input
          {...register('name')}
          type="text"
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
          placeholder="e.g., Cherry MX Red"
        />
        {errors.name && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Chinese Name</label>
        <input
          {...register('chineseName')}
          type="text"
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
          placeholder="e.g., 樱桃红轴"
        />
        {errors.chineseName && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.chineseName.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Switch Type (Optional)</label>
        <select
          {...register('type')}
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2"
        >
          <option value="">Select a type (optional)</option>
          <option value="LINEAR">Linear</option>
          <option value="TACTILE">Tactile</option>
          <option value="CLICKY">Clicky</option>
          <option value="SILENT_LINEAR">Silent Linear</option>
          <option value="SILENT_TACTILE">Silent Tactile</option>
        </select>
        {errors.type && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.type.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Manufacturer</label>
        <ManufacturerAutocomplete
          value={manufacturerValue || ''}
          onChange={(value) => setValue('manufacturer', value)}
          error={errors.manufacturer?.message}
          placeholder="Type to search manufacturers..."
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Switch Technology</label>
        <select
          {...register('technology')}
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2"
        >
          <option value="">Select technology (optional)</option>
          <option value="MECHANICAL">Mechanical</option>
          <option value="OPTICAL">Optical</option>
          <option value="MAGNETIC">Magnetic</option>
          <option value="INDUCTIVE">Inductive</option>
          <option value="ELECTRO_CAPACITIVE">Electro Capacitive</option>
        </select>
        {errors.technology && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.technology.message}</p>
        )}
      </div>

      {showMagneticFields && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Magnetic Pole Orientation</label>
            <select
              {...register('magnetOrientation')}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2"
            >
              <option value="">Select orientation (optional)</option>
              <option value="Horizontal">Horizontal</option>
              <option value="Vertical">Vertical</option>
            </select>
            {errors.magnetOrientation && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.magnetOrientation.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Magnet Position</label>
            <select
              {...register('magnetPosition')}
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2"
            >
              <option value="">Select position (optional)</option>
              <option value="Center">Center</option>
              <option value="Off-Center">Off-Center</option>
            </select>
            {errors.magnetPosition && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.magnetPosition.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Magnet Strength (Gs)</label>
            <input
              {...register('magnetStrength', { valueAsNumber: true })}
              type="number"
              step="0.1"
              min="0"
              max="10000"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="e.g., 35, 3500"
            />
            {errors.magnetStrength && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.magnetStrength.message}</p>
            )}
          </div>
        </>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Compatibility</label>
        <input
          {...register('compatibility')}
          type="text"
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
          placeholder="e.g., MX-compatible, Alps-compatible, Low-profile"
        />
        {errors.compatibility && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.compatibility.message}</p>
        )}
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Specs</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Actuation Force (g)</label>
            <input
              {...register('actuationForce', { valueAsNumber: true })}
              type="number"
              step="0.1"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="45"
            />
            {errors.actuationForce && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.actuationForce.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Bottom Out Force (g)</label>
            <input
              {...register('bottomOutForce', { valueAsNumber: true })}
              type="number"
              step="0.1"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="62"
            />
            {errors.bottomOutForce && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.bottomOutForce.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Pre Travel (mm)</label>
            <input
              {...register('preTravel', { valueAsNumber: true })}
              type="number"
              step="0.1"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="2.0"
            />
            {errors.preTravel && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.preTravel.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Bottom Out (mm)</label>
            <input
              {...register('bottomOut', { valueAsNumber: true })}
              type="number"
              step="0.1"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="4.0"
            />
            {errors.bottomOut && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.bottomOut.message}</p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Spring Details</h4>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Spring Weight</label>
            <input
              {...register('springWeight')}
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="62g"
            />
            {errors.springWeight && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.springWeight.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Spring Length (mm)</label>
            <input
              {...register('springLength')}
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="14mm"
            />
            {errors.springLength && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.springLength.message}</p>
            )}
          </div>
        </div>
      </div>


      <div className="space-y-4">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Materials</h4>
        
        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Top Housing</label>
          <input
            {...register('topHousing')}
            type="text"
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="e.g., Polycarbonate, Nylon"
          />
          {errors.topHousing && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.topHousing.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Bottom Housing</label>
          <input
            {...register('bottomHousing')}
            type="text"
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="e.g., Nylon, POM"
          />
          {errors.bottomHousing && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.bottomHousing.message}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Stem</label>
          <input
            {...register('stem')}
            type="text"
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="e.g., POM, UHMWPE"
          />
          {errors.stem && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.stem.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Date Obtained</label>
        <input
          {...register('dateObtained')}
          type="date"
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2"
        />
        {errors.dateObtained && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.dateObtained.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Image URL</label>
        <input
          {...register('imageUrl')}
          type="url"
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
          placeholder="https://example.com/switch.jpg"
        />
        {errors.imageUrl && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.imageUrl.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Notes</label>
        <textarea
          {...register('notes')}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
          placeholder="Any additional notes..."
        />
        {errors.notes && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.notes.message}</p>
        )}
      </div>
    </>
  )
}