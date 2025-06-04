'use client'

import { UseFormRegister, FieldErrors } from 'react-hook-form'
import { z } from 'zod'
import { switchSchema } from '@/lib/validation'

type SwitchFormData = z.infer<typeof switchSchema>

interface SwitchFormProps {
  register: UseFormRegister<SwitchFormData>
  errors: FieldErrors<SwitchFormData>
  defaultValues?: Partial<SwitchFormData>
}

export default function SwitchForm({ register, errors }: SwitchFormProps) {
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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Switch Type</label>
        <select
          {...register('type')}
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2"
        >
          <option value="">Select a type</option>
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
        <div className="flex items-center gap-2">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Manufacturer</label>
          <div className="relative group">
            <svg 
              className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" 
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path 
                fillRule="evenodd" 
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" 
                clipRule="evenodd" 
              />
            </svg>
            <div className="absolute left-1/2 transform -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
              If unsure, leave blank or select &quot;Unknown&quot;
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></div>
            </div>
          </div>
        </div>
        <input
          {...register('manufacturer')}
          type="text"
          list="manufacturers"
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
          placeholder="Optional - Type to search or select from dropdown"
        />
        <datalist id="manufacturers">
          <option value="ABT" />
          <option value="Aflion" />
          <option value="Alps" />
          <option value="Aristotle" />
          <option value="BSUN" />
          <option value="Burgess" />
          <option value="Cherry" />
          <option value="Duhuk Lumia" />
          <option value="Gateron" />
          <option value="Grain Gold" />
          <option value="Greetech" />
          <option value="Haimu" />
          <option value="HMX" />
          <option value="Huano" />
          <option value="Jedel" />
          <option value="Jerrzi" />
          <option value="Jixian" />
          <option value="JWICK" />
          <option value="JWK" />
          <option value="Kailh" />
          <option value="Keygeek" />
          <option value="KTT" />
          <option value="LCET" />
          <option value="Lichicx" />
          <option value="NewGiant" />
          <option value="Omron" />
          <option value="Outemu" />
          <option value="Raesha" />
          <option value="SOAI/Leobog" />
          <option value="SP Star" />
          <option value="Swikeys" />
          <option value="Tecsee" />
          <option value="TTC" />
          <option value="Unknown" />
          <option value="Varmilo" />
          <option value="Weipeng" />
          <option value="Xiang Min" />
          <option value="Yusya" />
          <option value="Zorro" />
        </datalist>
        {errors.manufacturer && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.manufacturer.message}</p>
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