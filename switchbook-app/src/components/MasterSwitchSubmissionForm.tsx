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
  type: z.enum(['LINEAR', 'TACTILE', 'CLICKY', 'SILENT_LINEAR', 'SILENT_TACTILE']).optional().or(z.literal('')),
  technology: z.enum(['MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE']).optional().or(z.literal('')),
  compatibility: z.string().optional(),
  
  // Force specifications
  initialForce: z.number().min(0).max(1000).optional().or(z.nan()),
  actuationForce: z.number().min(0).max(1000).optional().or(z.nan()),
  tactileForce: z.number().min(0).max(1000).optional().or(z.nan()),
  tactilePosition: z.number().min(0).max(10).optional().or(z.nan()),
  bottomOutForce: z.number().min(0).max(1000).optional().or(z.nan()),
  preTravel: z.number().min(0).max(10).optional().or(z.nan()),
  bottomOut: z.number().min(0).max(10).optional().or(z.nan()),
  
  // Spring specifications
  springWeight: z.string().optional(),
  springLength: z.string().optional(),
  progressiveSpring: z.boolean().optional(),
  doubleStage: z.boolean().optional(),
  clickType: z.enum(['CLICK_LEAF', 'CLICK_BAR', 'CLICK_JACKET']).optional().or(z.literal('')),
  
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
  notes: z.string().optional(),
  imageUrl: z.union([z.string().url('Invalid URL'), z.literal('')]).optional(),
  
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
    mode: 'onBlur', // Show errors when field loses focus
  });

  // Clean data before submission
  const handleFormSubmit = (data: MasterSwitchSubmissionData) => {
    console.log('Form handleFormSubmit called with data:', data);
    console.log('Form submitted with data:', data);
    // Convert NaN values to undefined for optional number fields
    const cleanedData = {
      ...data,
      initialForce: isNaN(data.initialForce as number) ? undefined : data.initialForce,
      actuationForce: isNaN(data.actuationForce as number) ? undefined : data.actuationForce,
      tactileForce: isNaN(data.tactileForce as number) ? undefined : data.tactileForce,
      tactilePosition: isNaN(data.tactilePosition as number) ? undefined : data.tactilePosition,
      bottomOutForce: isNaN(data.bottomOutForce as number) ? undefined : data.bottomOutForce,
      preTravel: isNaN(data.preTravel as number) ? undefined : data.preTravel,
      bottomOut: isNaN(data.bottomOut as number) ? undefined : data.bottomOut,
      initialMagneticFlux: isNaN(data.initialMagneticFlux as number) ? undefined : data.initialMagneticFlux,
      bottomOutMagneticFlux: isNaN(data.bottomOutMagneticFlux as number) ? undefined : data.bottomOutMagneticFlux,
      // Clean string fields - convert empty strings to undefined
      type: data.type === '' ? undefined : data.type,
      technology: data.technology === '' ? undefined : data.technology,
      clickType: data.clickType === '' ? undefined : data.clickType,
      imageUrl: data.imageUrl && data.imageUrl.trim() !== '' ? data.imageUrl.trim() : undefined,
    };
    
    onSubmit(cleanedData);
  };

  const manufacturerValue = watch('manufacturer');
  const technologyValue = watch('technology');
  const typeValue = watch('type');
  const showTactileForce = typeValue === 'TACTILE' || typeValue === 'SILENT_TACTILE' || typeValue === 'CLICKY';
  const showTactilePosition = typeValue === 'TACTILE' || typeValue === 'SILENT_TACTILE' || typeValue === 'CLICKY';
  const showClickType = typeValue === 'CLICKY';

  // Show magnetic fields when magnetic technology is selected
  if (technologyValue === 'MAGNETIC' && !showMagneticFields) {
    setShowMagneticFields(true);
  } else if (technologyValue !== 'MAGNETIC' && showMagneticFields) {
    setShowMagneticFields(false);
  }

  return (
    <form 
      onSubmit={handleSubmit(handleFormSubmit, (errors) => {
        console.error('Form validation errors:', errors);
        // Log specific field errors
        Object.entries(errors).forEach(([field, error]) => {
          console.error(`Field '${field}' error:`, error);
        });
        // Scroll to top to show error summary
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Show an alert with the first error
        const firstError = Object.values(errors)[0] as any;
        if (firstError && firstError.message) {
          alert(`Please fix the following error: ${firstError.message}`);
        }
      })}
      className="space-y-6"
    >
      {/* Validation Error Summary */}
      {Object.keys(errors).length > 0 && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2">Please fix the following errors:</h3>
          <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-300 space-y-1">
            {Object.entries(errors).map(([field, error]) => (
              <li key={field}>
                <strong>{field}:</strong> {(error as any)?.message || 'Invalid value'}
              </li>
            ))}
            {errors.imageUrl && <li>Image URL must be a valid URL</li>}
          </ul>
        </div>
      )}
      
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
              className={`w-full rounded-md border ${errors.name ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500`}
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
              <span className="inline-flex items-center gap-1">
                Manufacturer <span className="text-red-500">*</span>
                <span className="relative group">
                  <svg 
                    className="w-4 h-4 text-gray-400 dark:text-gray-500 cursor-help" 
                    fill="none" 
                    stroke="currentColor" 
                    viewBox="0 0 24 24"
                  >
                    <path 
                      strokeLinecap="round" 
                      strokeLinejoin="round" 
                      strokeWidth={2} 
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" 
                    />
                  </svg>
                  <span className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-56 p-2 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-md shadow-lg z-10">
                    If you don&apos;t know the manufacturer, you can enter &quot;Unknown&quot; in this field.
                    <span className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1 w-0 h-0 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700"></span>
                  </span>
                </span>
              </span>
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

          {showTactileForce && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tactile Force (g)
              </label>
              <input
                {...register('tactileForce', { valueAsNumber: true })}
                type="number"
                step="0.1"
                min="0"
                max="1000"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="55"
              />
            </div>
          )}

          {showTactilePosition && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tactile Position (mm)
              </label>
              <input
                {...register('tactilePosition', { valueAsNumber: true })}
                type="number"
                step="0.1"
                className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
                placeholder="e.g., 0.3, 1.5"
              />
            </div>
          )}

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
        
        <div className="grid grid-cols-2 gap-4 mt-4">
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
        
        {showClickType && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Click Type
            </label>
            <select
              {...register('clickType')}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2"
            >
              <option value="">Select click type</option>
              <option value="CLICK_LEAF">Click Leaf</option>
              <option value="CLICK_BAR">Click Bar</option>
              <option value="CLICK_JACKET">Click Jacket</option>
            </select>
          </div>
        )}
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
              Notes
            </label>
            <textarea
              {...register('notes')}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Any additional information about the switch..."
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Image URL
            </label>
            <input
              {...register('imageUrl')}
              type="text"
              className={`w-full rounded-md border ${errors.imageUrl ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500`}
              placeholder="https://example.com/switch-image.jpg"
            />
            {errors.imageUrl && (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.imageUrl.message}</p>
            )}
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Provide a URL to an image of the switch. Uploads are not available for master switches.
            </p>
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
            className={`w-full rounded-md border ${errors.submissionNotes ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'} bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500`}
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
          onClick={() => console.log('Submit button clicked')}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit for Review'}
        </button>
      </div>
    </form>
  );
}