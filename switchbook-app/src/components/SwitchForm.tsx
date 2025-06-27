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
  showFrankenswitch?: boolean
  isLinkedToMaster?: boolean
}

export default function SwitchForm({ register, errors, setValue, watch, showFrankenswitch = false, isLinkedToMaster = false }: SwitchFormProps) {
  const manufacturerValue = watch('manufacturer')
  const technologyValue = watch('technology')
  const typeValue = watch('type')
  const showMagneticFields = technologyValue === 'MAGNETIC'
  const showTactileForce = typeValue === 'TACTILE' || typeValue === 'SILENT_TACTILE'
  const showClickType = typeValue === 'CLICKY'
  
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
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Initial Force (g)</label>
            <input
              {...register('initialForce', { valueAsNumber: true })}
              type="number"
              step="0.1"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="20"
            />
            {errors.initialForce && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.initialForce.message}</p>
            )}
          </div>

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

          {showTactileForce && (
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Tactile Force (g)</label>
              <input
                {...register('tactileForce', { valueAsNumber: true })}
                type="number"
                step="0.1"
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="55"
              />
              {errors.tactileForce && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.tactileForce.message}</p>
              )}
            </div>
          )}

          {showClickType && (
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Click Type</label>
              <select
                {...register('clickType')}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2"
              >
                <option value="">Select click type</option>
                <option value="CLICK_LEAF">Click Leaf</option>
                <option value="CLICK_BAR">Click Bar</option>
                <option value="CLICK_JACKET">Click Jacket</option>
              </select>
              {errors.clickType && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.clickType.message}</p>
              )}
            </div>
          )}

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
              step="0.01"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="2.0"
            />
            {errors.preTravel && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.preTravel.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Bottom Out/Total Travel (mm)</label>
            <input
              {...register('bottomOut', { valueAsNumber: true })}
              type="number"
              step="0.01"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="4.0"
            />
            {errors.bottomOut && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.bottomOut.message}</p>
            )}
          </div>

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

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center">
            <input
              {...register('progressiveSpring')}
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Progressive Spring
            </label>
          </div>

          <div className="flex items-center">
            <input
              {...register('doubleStage')}
              type="checkbox"
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400 border-gray-300 dark:border-gray-600 rounded"
            />
            <label className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Double Stage
            </label>
          </div>
        </div>
      </div>

      {showMagneticFields && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Magnet Details</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Initial Magnetic Flux (Gs)</label>
              <input
                {...register('initialMagneticFlux', { valueAsNumber: true })}
                type="number"
                step="0.1"
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="35"
              />
              {errors.initialMagneticFlux && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.initialMagneticFlux.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Bottom Out Magnetic Flux (Gs)</label>
              <input
                {...register('bottomOutMagneticFlux', { valueAsNumber: true })}
                type="number"
                step="0.1"
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="3500"
              />
              {errors.bottomOutMagneticFlux && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.bottomOutMagneticFlux.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Magnetic Pole Orientation</label>
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
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Magnet Position</label>
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
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">PCB Thickness</label>
              <select
                {...register('pcbThickness')}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2"
              >
                <option value="">Select thickness (optional)</option>
                <option value="1.2mm">1.2mm</option>
                <option value="1.6mm">1.6mm</option>
              </select>
              {errors.pcbThickness && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.pcbThickness.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Magnet Polarity</label>
              <select
                {...register('magnetPolarity')}
                className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2"
              >
                <option value="">Select polarity (optional)</option>
                <option value="North">North</option>
                <option value="South">South</option>
              </select>
              {errors.magnetPolarity && (
                <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.magnetPolarity.message}</p>
              )}
            </div>
          </div>
        </div>
      )}



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

      {showFrankenswitch && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">Franken Parts</h4>
          
          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Franken Top</label>
            <input
              {...register('frankenTop')}
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="e.g., Cherry MX Top"
            />
            {errors.frankenTop && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.frankenTop.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Franken Bottom</label>
            <input
              {...register('frankenBottom')}
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="e.g., Gateron Bottom"
            />
            {errors.frankenBottom && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.frankenBottom.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 dark:text-gray-400">Franken Stem</label>
            <input
              {...register('frankenStem')}
              type="text"
              className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="e.g., NK Cream Stem"
            />
            {errors.frankenStem && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.frankenStem.message}</p>
            )}
          </div>
        </div>
      )}

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
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
          {isLinkedToMaster ? 'Master Database Notes' : 'Notes'}
        </label>
        <textarea
          {...register('notes')}
          rows={3}
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
          placeholder={isLinkedToMaster ? "Notes from the master database..." : "Any additional notes..."}
        />
        {errors.notes && (
          <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.notes.message}</p>
        )}
      </div>

      {isLinkedToMaster && (
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Personal Notes</label>
          <textarea
            {...register('personalNotes')}
            rows={3}
            className="mt-1 block w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm focus:border-blue-500 dark:focus:border-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400 sm:text-sm px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Your personal notes (preserved when resetting to master)..."
          />
          {errors.personalNotes && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.personalNotes.message}</p>
          )}
        </div>
      )}
    </>
  )
}