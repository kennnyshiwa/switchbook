'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import ManufacturerAutocomplete from './ManufacturerAutocomplete';
import { useState } from 'react';
import { validateImageUrl } from '@/lib/image-security';

// Schema for master switch submission
const masterSwitchSubmissionSchema = z.object({
  name: z.string().min(1, 'Switch name is required'),
  chineseName: z.string().optional(),
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  type: z.enum(['LINEAR', 'TACTILE', 'CLICKY', 'SILENT_LINEAR', 'SILENT_TACTILE']).optional(),
  technology: z.enum(['MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE']).optional(),
  compatibility: z.string().optional(),
  
  // Force specifications
  initialForce: z.number().min(0).max(1000).optional().or(z.nan()),
  actuationForce: z.number().min(0).max(1000).optional().or(z.nan()),
  bottomOutForce: z.number().min(0).max(1000).optional().or(z.nan()),
  preTravel: z.number().min(0).max(10).optional().or(z.nan()),
  bottomOut: z.number().min(0).max(10).optional().or(z.nan()),
  
  // Spring specifications
  springWeight: z.string().optional(),
  springLength: z.string().optional(),
  
  // Materials
  topHousing: z.string().optional(),
  bottomHousing: z.string().optional(),
  stem: z.string().optional(),
  
  // Magnetic specifications
  magnetOrientation: z.string().optional(),
  magnetPosition: z.string().optional(),
  magnetPolarity: z.string().optional(),
  initialMagneticFlux: z.number().min(0).max(10000).optional().or(z.nan()),
  bottomOutMagneticFlux: z.number().min(0).max(10000).optional().or(z.nan()),
  pcbThickness: z.string().optional(),
  
  // Additional info
  imageUrl: z.string().optional().refine((url) => {
    if (!url || url === "") return true
    const validation = validateImageUrl(url)
    return validation.valid
  }, {
    message: "Invalid image URL or security violation"
  }),
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
      initialForce: isNaN(data.initialForce as number) ? undefined : data.initialForce,
      actuationForce: isNaN(data.actuationForce as number) ? undefined : data.actuationForce,
      bottomOutForce: isNaN(data.bottomOutForce as number) ? undefined : data.bottomOutForce,
      preTravel: isNaN(data.preTravel as number) ? undefined : data.preTravel,
      bottomOut: isNaN(data.bottomOut as number) ? undefined : data.bottomOut,
      initialMagneticFlux: isNaN(data.initialMagneticFlux as number) ? undefined : data.initialMagneticFlux,
      bottomOutMagneticFlux: isNaN(data.bottomOutMagneticFlux as number) ? undefined : data.bottomOutMagneticFlux,
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
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Basic Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Switch Name <span className="text-red-500">*</span>
            </label>
            <input
              {...register('name')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="e.g., Cherry MX Red"
            />
            {errors.name && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Chinese Name
            </label>
            <input
              {...register('chineseName')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
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
              Switch Type
            </label>
            <select
              {...register('type')}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
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
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
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
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="e.g., MX-style, Alps, Choc"
            />
          </div>

        </div>
      </div>

      {/* Force Specifications */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Force Specifications</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initial Force (g)
            </label>
            <input
              {...register('initialForce', { valueAsNumber: true })}
              type="number"
              step="0.1"
              min="0"
              max="1000"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="20"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Actuation Force (g)
            </label>
            <input
              {...register('actuationForce', { valueAsNumber: true })}
              type="number"
              step="0.1"
              min="0"
              max="1000"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="45"
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
              max="1000"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="62"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Pre Travel (mm)
            </label>
            <input
              {...register('preTravel', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0"
              max="10"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="2.0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bottom Out/Total Travel (mm)
            </label>
            <input
              {...register('bottomOut', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0"
              max="10"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="4.0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Spring Weight
            </label>
            <input
              {...register('springWeight')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="62g"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Spring Length
            </label>
            <input
              {...register('springLength')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="14mm"
            />
          </div>
        </div>
      </div>


      {/* Materials */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Materials</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Top Housing
            </label>
            <input
              {...register('topHousing')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="e.g., Polycarbonate, Nylon"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bottom Housing
            </label>
            <input
              {...register('bottomHousing')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="e.g., Nylon, POM"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stem
            </label>
            <input
              {...register('stem')}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="e.g., POM, UHMWPE"
            />
          </div>
        </div>
      </div>

      {/* Magnetic Fields (conditional) */}
      {showMagneticFields && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Magnetic Specifications</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Initial Magnetic Flux (Gs)
              </label>
              <input
                {...register('initialMagneticFlux', { valueAsNumber: true })}
                type="number"
                step="0.1"
                min="0"
                max="10000"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="35"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bottom Out Magnetic Flux (Gs)
              </label>
              <input
                {...register('bottomOutMagneticFlux', { valueAsNumber: true })}
                type="number"
                step="0.1"
                min="0"
                max="10000"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="3500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Magnetic Pole Orientation
              </label>
              <select
                {...register('magnetOrientation')}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              >
                <option value="">Select orientation</option>
                <option value="Horizontal">Horizontal</option>
                <option value="Vertical">Vertical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Magnet Position
              </label>
              <select
                {...register('magnetPosition')}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              >
                <option value="">Select position</option>
                <option value="Center">Center</option>
                <option value="Off-Center">Off-Center</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                PCB Thickness
              </label>
              <select
                {...register('pcbThickness')}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              >
                <option value="">Select thickness</option>
                <option value="1.2mm">1.2mm</option>
                <option value="1.6mm">1.6mm</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Magnet Polarity
              </label>
              <select
                {...register('magnetPolarity')}
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              >
                <option value="">Select polarity</option>
                <option value="North">North</option>
                <option value="South">South</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Additional Information */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Additional Information</h2>
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Image URL
            </label>
            <input
              {...register('imageUrl')}
              type="url"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="https://example.com/switch.jpg"
            />
            {errors.imageUrl && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.imageUrl.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Any additional information about the switch..."
            />
          </div>
        </div>
      </div>

      {/* Submission Reason */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Submission Details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Why should this switch be added? <span className="text-red-500">*</span>
          </label>
          <textarea
            {...register('submissionNotes')}
            rows={4}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Please provide details about this switch, its significance, and any sources for the specifications you've provided..."
          />
          {errors.submissionNotes && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.submissionNotes.message}</p>
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