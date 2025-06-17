'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import ManufacturerAutocomplete from './ManufacturerAutocomplete';
import { useState } from 'react';

// Schema for master switch submission
const masterSwitchSubmissionSchema = z.object({
  name: z.string().min(1, 'Switch name is required'),
  chineseName: z.string().optional(),
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  brand: z.string().optional(),
  type: z.enum(['LINEAR', 'TACTILE', 'CLICKY', 'SILENT_LINEAR', 'SILENT_TACTILE']).optional(),
  technology: z.enum(['MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE']).optional(),
  compatibility: z.string().optional(),
  
  // Physical specifications
  actuationForce: z.number().min(0).max(200).optional().or(z.nan()),
  bottomOutForce: z.number().min(0).max(200).optional().or(z.nan()),
  preTravel: z.number().min(0).max(10).optional().or(z.nan()),
  totalTravel: z.number().min(0).max(10).optional().or(z.nan()),
  
  // Spring specifications
  springType: z.string().optional(),
  springForce: z.string().optional(),
  springMaterialType: z.string().optional(),
  springLength: z.string().optional(),
  
  // Housing specifications
  topHousingMaterial: z.string().optional(),
  bottomHousingMaterial: z.string().optional(),
  stemMaterial: z.string().optional(),
  stemColor: z.string().optional(),
  
  // Magnetic specifications (only for magnetic switches)
  magneticActuationPoint: z.number().min(0).max(10).optional().or(z.nan()),
  magneticBottomOut: z.number().min(0).max(10).optional().or(z.nan()),
  magneticInitialPosition: z.number().min(0).max(10).optional().or(z.nan()),
  
  // Additional info
  preLubed: z.boolean().optional(),
  releaseYear: z.number().min(1970).max(new Date().getFullYear() + 1).optional().or(z.nan()),
  lifespan: z.string().optional(),
  productUrl: z.string().optional().refine(
    (val) => !val || val === '' || /^https?:\/\/.+/.test(val),
    { message: 'Please enter a valid URL or leave empty' }
  ),
  imageUrl: z.string().optional().refine(
    (val) => !val || val === '' || /^https?:\/\/.+/.test(val),
    { message: 'Please enter a valid URL or leave empty' }
  ),
  notes: z.string().optional(),
  
  // Submission reason
  submissionNotes: z.string().min(10, 'Please provide details about this switch and why it should be added'),
});

type MasterSwitchSubmissionData = z.infer<typeof masterSwitchSubmissionSchema>;

interface MasterSwitchSubmissionFormProps {
  onSubmit: (data: MasterSwitchSubmissionData) => Promise<void>;
  isSubmitting: boolean;
}

export function MasterSwitchSubmissionForm({ onSubmit, isSubmitting }: MasterSwitchSubmissionFormProps) {
  const [showMagneticFields, setShowMagneticFields] = useState(false);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<MasterSwitchSubmissionData>({
    resolver: zodResolver(masterSwitchSubmissionSchema),
  });

  // Clean data before submission
  const handleFormSubmit = (data: MasterSwitchSubmissionData) => {
    // Convert NaN values to undefined for optional number fields
    const cleanedData = {
      ...data,
      actuationForce: isNaN(data.actuationForce as number) ? undefined : data.actuationForce,
      bottomOutForce: isNaN(data.bottomOutForce as number) ? undefined : data.bottomOutForce,
      preTravel: isNaN(data.preTravel as number) ? undefined : data.preTravel,
      totalTravel: isNaN(data.totalTravel as number) ? undefined : data.totalTravel,
      magneticActuationPoint: isNaN(data.magneticActuationPoint as number) ? undefined : data.magneticActuationPoint,
      magneticBottomOut: isNaN(data.magneticBottomOut as number) ? undefined : data.magneticBottomOut,
      magneticInitialPosition: isNaN(data.magneticInitialPosition as number) ? undefined : data.magneticInitialPosition,
      releaseYear: isNaN(data.releaseYear as number) ? undefined : data.releaseYear,
    };
    
    onSubmit(cleanedData);
  };

  const manufacturerValue = watch('manufacturer');
  const technologyValue = watch('technology');

  // Show magnetic fields when magnetic technology is selected
  if (technologyValue === 'MAGNETIC' && !showMagneticFields) {
    setShowMagneticFields(true);
  } else if (technologyValue !== 'MAGNETIC' && showMagneticFields) {
    setShowMagneticFields(false);
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Basic Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Switch Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="e.g., Cherry MX Red"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Chinese Name
            </label>
            <input
              {...register('chineseName')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="e.g., 樱桃红轴"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Manufacturer <span className="text-red-500">*</span>
            </label>
            <ManufacturerAutocomplete
              value={manufacturerValue || ''}
              onChange={(value) => setValue('manufacturer', value)}
              error={errors.manufacturer?.message}
              placeholder="Type to search manufacturers..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Brand
            </label>
            <input
              {...register('brand')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Switch Type
            </label>
            <select
              {...register('type')}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            >
              <option value="">Select type</option>
              <option value="LINEAR">Linear</option>
              <option value="TACTILE">Tactile</option>
              <option value="CLICKY">Clicky</option>
              <option value="SILENT_LINEAR">Silent Linear</option>
              <option value="SILENT_TACTILE">Silent Tactile</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Technology
            </label>
            <select
              {...register('technology')}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            >
              <option value="">Select technology</option>
              <option value="MECHANICAL">Mechanical</option>
              <option value="OPTICAL">Optical</option>
              <option value="MAGNETIC">Magnetic</option>
              <option value="INDUCTIVE">Inductive</option>
              <option value="ELECTRO_CAPACITIVE">Electro Capacitive</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Compatibility
            </label>
            <input
              {...register('compatibility')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="e.g., MX-style, Alps, Choc"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Release Year
            </label>
            <input
              {...register('releaseYear', { valueAsNumber: true })}
              type="number"
              min="1970"
              max={new Date().getFullYear() + 1}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Force Specifications */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Force Specifications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Actuation Force (g)
            </label>
            <input
              {...register('actuationForce', { valueAsNumber: true })}
              type="number"
              step="0.1"
              min="0"
              max="200"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bottom Out Force (g)
            </label>
            <input
              {...register('bottomOutForce', { valueAsNumber: true })}
              type="number"
              step="0.1"
              min="0"
              max="200"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pre-Travel (mm)
            </label>
            <input
              {...register('preTravel', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0"
              max="10"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Total Travel (mm)
            </label>
            <input
              {...register('totalTravel', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0"
              max="10"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Spring Specifications */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Spring Specifications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Spring Type
            </label>
            <input
              {...register('springType')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="e.g., Progressive, Linear"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Spring Force
            </label>
            <input
              {...register('springForce')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="e.g., 62g, TX 67g"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Spring Material
            </label>
            <input
              {...register('springMaterialType')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="e.g., Stainless Steel"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Spring Length (mm)
            </label>
            <input
              {...register('springLength')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="e.g., 14mm, 15mm"
            />
          </div>
        </div>
      </div>

      {/* Materials */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Materials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Top Housing Material
            </label>
            <input
              {...register('topHousingMaterial')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="e.g., Polycarbonate, Nylon"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bottom Housing Material
            </label>
            <input
              {...register('bottomHousingMaterial')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="e.g., Polycarbonate, Nylon"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stem Material
            </label>
            <input
              {...register('stemMaterial')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="e.g., POM, UHMWPE"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stem Color
            </label>
            <input
              {...register('stemColor')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="e.g., Red, Black, Clear"
            />
          </div>
        </div>
      </div>

      {/* Magnetic Fields (conditional) */}
      {showMagneticFields && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Magnetic Specifications</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Actuation Point (mm)
              </label>
              <input
                {...register('magneticActuationPoint', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                max="10"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bottom Out (mm)
              </label>
              <input
                {...register('magneticBottomOut', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                max="10"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Initial Position (mm)
              </label>
              <input
                {...register('magneticInitialPosition', { valueAsNumber: true })}
                type="number"
                step="0.01"
                min="0"
                max="10"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              />
            </div>
          </div>
        </div>
      )}

      {/* Additional Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Additional Information</h2>
        <div className="grid grid-cols-1 gap-4">
          <div className="flex items-center">
            <input
              {...register('preLubed')}
              type="checkbox"
              className="h-4 w-4 text-purple-600 rounded border-gray-300"
            />
            <label className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
              Pre-lubed from factory
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Lifespan
            </label>
            <input
              {...register('lifespan')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="e.g., 50 million actuations"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Product URL
            </label>
            <input
              {...register('productUrl')}
              type="url"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="https://..."
            />
            {errors.productUrl && (
              <p className="mt-1 text-sm text-red-600">{errors.productUrl.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Image URL
            </label>
            <input
              {...register('imageUrl')}
              type="url"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="https://..."
            />
            {errors.imageUrl && (
              <p className="mt-1 text-sm text-red-600">{errors.imageUrl.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
              placeholder="Any additional information about the switch..."
            />
          </div>
        </div>
      </div>

      {/* Submission Reason */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Submission Details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Why should this switch be added? <span className="text-red-500">*</span>
          </label>
          <textarea
            {...register('submissionNotes')}
            rows={4}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            placeholder="Please provide details about this switch, its significance, and any sources for the specifications you've provided..."
          />
          {errors.submissionNotes && (
            <p className="mt-1 text-sm text-red-600">{errors.submissionNotes.message}</p>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end gap-4">
        <button
          type="button"
          onClick={() => window.history.back()}
          className="px-6 py-2 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </div>
    </form>
  );
}