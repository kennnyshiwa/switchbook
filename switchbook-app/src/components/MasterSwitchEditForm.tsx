'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import ManufacturerAutocomplete from './ManufacturerAutocomplete';
import { useState } from 'react';

// Schema for edit suggestion
const editSuggestionSchema = z.object({
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
  
  // Edit reason
  editReason: z.string().min(10, 'Please explain what you changed and why'),
  changedFields: z.array(z.string()).min(1, 'You must change at least one field'),
});

type EditSuggestionData = z.infer<typeof editSuggestionSchema>;

interface MasterSwitchEditFormProps {
  currentData: any;
  onSubmit: (data: EditSuggestionData) => Promise<void>;
  isSubmitting: boolean;
}

export function MasterSwitchEditForm({ currentData, onSubmit, isSubmitting }: MasterSwitchEditFormProps) {
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    getValues,
  } = useForm<EditSuggestionData>({
    resolver: zodResolver(editSuggestionSchema),
    defaultValues: {
      ...currentData,
      totalTravel: currentData.bottomOut,
      springForce: currentData.springWeight,
      topHousingMaterial: currentData.topHousing,
      bottomHousingMaterial: currentData.bottomHousing,
      stemMaterial: currentData.stem,
      changedFields: [],
    },
  });

  const manufacturerValue = watch('manufacturer');

  // Track field changes
  const handleFieldChange = (fieldName: string, newValue: any) => {
    const originalValue = currentData[fieldName];
    if (newValue !== originalValue) {
      setChangedFields(prev => new Set(prev).add(fieldName));
    } else {
      setChangedFields(prev => {
        const newSet = new Set(prev);
        newSet.delete(fieldName);
        return newSet;
      });
    }
  };

  // Clean data before submission
  const handleFormSubmit = (data: EditSuggestionData) => {
    // Convert NaN values to undefined for optional number fields
    const cleanedData = {
      ...data,
      actuationForce: isNaN(data.actuationForce as number) ? undefined : data.actuationForce,
      bottomOutForce: isNaN(data.bottomOutForce as number) ? undefined : data.bottomOutForce,
      preTravel: isNaN(data.preTravel as number) ? undefined : data.preTravel,
      totalTravel: isNaN(data.totalTravel as number) ? undefined : data.totalTravel,
      releaseYear: isNaN(data.releaseYear as number) ? undefined : data.releaseYear,
      changedFields: Array.from(changedFields),
    };
    
    if (changedFields.size === 0) {
      alert('Please make at least one change before submitting');
      return;
    }
    
    onSubmit(cleanedData);
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Current vs Edited Indicator */}
      {changedFields.size > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <span className="font-medium">Fields changed:</span> {Array.from(changedFields).join(', ')}
          </p>
        </div>
      )}

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
              onChange={(e) => {
                register('name').onChange(e);
                handleFieldChange('name', e.target.value);
              }}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
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
              onChange={(e) => {
                register('chineseName').onChange(e);
                handleFieldChange('chineseName', e.target.value);
              }}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Manufacturer <span className="text-red-500">*</span>
            </label>
            <ManufacturerAutocomplete
              value={manufacturerValue || ''}
              onChange={(value) => {
                setValue('manufacturer', value);
                handleFieldChange('manufacturer', value);
              }}
              error={errors.manufacturer?.message}
              placeholder="Type to search manufacturers..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Type
            </label>
            <select
              {...register('type')}
              onChange={(e) => {
                register('type').onChange(e);
                handleFieldChange('type', e.target.value);
              }}
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
              onChange={(e) => {
                register('actuationForce', { valueAsNumber: true }).onChange(e);
                handleFieldChange('actuationForce', e.target.valueAsNumber);
              }}
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
              onChange={(e) => {
                register('bottomOutForce', { valueAsNumber: true }).onChange(e);
                handleFieldChange('bottomOutForce', e.target.valueAsNumber);
              }}
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
              onChange={(e) => {
                register('preTravel', { valueAsNumber: true }).onChange(e);
                handleFieldChange('preTravel', e.target.valueAsNumber);
              }}
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
              onChange={(e) => {
                register('totalTravel', { valueAsNumber: true }).onChange(e);
                handleFieldChange('bottomOut', e.target.valueAsNumber);
              }}
              type="number"
              step="0.01"
              min="0"
              max="10"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* Edit Reason */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Edit Details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            What did you change and why? <span className="text-red-500">*</span>
          </label>
          <textarea
            {...register('editReason')}
            rows={4}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2"
            placeholder="Please explain what information you've updated and provide any sources or references for your changes..."
          />
          {errors.editReason && (
            <p className="mt-1 text-sm text-red-600">{errors.editReason.message}</p>
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
          disabled={isSubmitting || changedFields.size === 0}
          className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Submitting...' : 'Submit Edit Suggestion'}
        </button>
      </div>
    </form>
  );
}