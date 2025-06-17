'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import ManufacturerAutocomplete from './ManufacturerAutocomplete';
import { useState } from 'react';

// Schema for edit suggestion
const editSuggestionSchema = z.object({
  name: z.string().min(1, 'Switch name is required'),
  chineseName: z.string().optional().nullable(),
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  brand: z.string().optional().nullable(),
  type: z.enum(['LINEAR', 'TACTILE', 'CLICKY', 'SILENT_LINEAR', 'SILENT_TACTILE']).optional().nullable(),
  technology: z.enum(['MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE']).optional().nullable(),
  compatibility: z.string().optional().nullable(),
  
  // Physical specifications
  actuationForce: z.number().min(0).max(200).optional().or(z.nan()),
  bottomOutForce: z.number().min(0).max(200).optional().or(z.nan()),
  preTravel: z.number().min(0).max(10).optional().or(z.nan()),
  totalTravel: z.number().min(0).max(10).optional().or(z.nan()),
  
  // Spring specifications
  springType: z.string().optional().nullable(),
  springForce: z.string().optional().nullable(),
  springMaterialType: z.string().optional().nullable(),
  springLength: z.string().optional().nullable(),
  
  // Housing specifications
  topHousingMaterial: z.string().optional().nullable(),
  bottomHousingMaterial: z.string().optional().nullable(),
  stemMaterial: z.string().optional().nullable(),
  stemColor: z.string().optional().nullable(),
  
  // Additional info
  preLubed: z.boolean().optional(),
  releaseYear: z.number().min(1970).max(new Date().getFullYear() + 1).optional().or(z.nan()),
  lifespan: z.string().optional().nullable(),
  productUrl: z.string().optional().nullable().refine(
    (val) => !val || val === '' || /^https?:\/\/.+/.test(val),
    { message: 'Please enter a valid URL or leave empty' }
  ),
  imageUrl: z.string().optional().nullable().refine(
    (val) => !val || val === '' || /^https?:\/\/.+/.test(val),
    { message: 'Please enter a valid URL or leave empty' }
  ),
  notes: z.string().optional().nullable(),
  
  // Edit reason
  editReason: z.string().min(10, 'Please explain what you changed and why'),
});

type EditSuggestionData = z.infer<typeof editSuggestionSchema> & {
  changedFields?: string[];
};

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
      totalTravel: currentData.bottomOut || '',
      springForce: currentData.springWeight || '',
      topHousingMaterial: currentData.topHousing || '',
      bottomHousingMaterial: currentData.bottomHousing || '',
      stemMaterial: currentData.stem || '',
      imageUrl: currentData.imageUrl || '',
      productUrl: currentData.productUrl || '',
      editReason: '',
    },
  });

  const manufacturerValue = watch('manufacturer');

  // Track field changes
  const handleFieldChange = (fieldName: string, newValue: any) => {
    // Map form field names to currentData field names
    const fieldMapping: { [key: string]: string } = {
      totalTravel: 'bottomOut',
      springForce: 'springWeight',
      topHousingMaterial: 'topHousing',
      bottomHousingMaterial: 'bottomHousing',
      stemMaterial: 'stem',
    };
    
    const dataFieldName = fieldMapping[fieldName] || fieldName;
    const originalValue = (currentData as any)[dataFieldName];
    
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
    console.log('Form submitted with data:', data);
    console.log('Changed fields:', Array.from(changedFields));
    
    if (changedFields.size === 0) {
      alert('Please make at least one change before submitting');
      return;
    }
    
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
    
    console.log('Submitting cleaned data:', cleanedData);
    onSubmit(cleanedData);
  };

  // Log errors for debugging
  if (Object.keys(errors).length > 0) {
    console.log('Form validation errors:', errors);
  }

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
                handleFieldChange('totalTravel', e.target.valueAsNumber);
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