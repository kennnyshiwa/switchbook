'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import ManufacturerAutocomplete from './ManufacturerAutocomplete';
import { useState, useEffect, useMemo, useRef } from 'react';
import { getMaterials } from '@/utils/materials';
import { getStemShapes } from '@/utils/stemShapes';
import { IMAGE_CONFIG } from '@/lib/image-config';
import { apiErrorMessage, responseJsonBody } from '@/lib/client-api-error';

interface SwitchImage {
  id: string;
  url: string;
  type: 'UPLOADED' | 'LINKED';
  order: number;
  caption?: string | null;
  thumbnailUrl?: string;
  mediumUrl?: string;
}

interface MasterSwitchFormData {
  id: string;
  name?: string;
  notes?: string | null;
  chineseName?: string | null;
  compatibility?: string | null;
  springWeight?: string | null;
  springLength?: string | null;
  topHousing?: string | null;
  bottomHousing?: string | null;
  stem?: string | null;
  magnetOrientation?: string | null;
  magnetPosition?: string | null;
  magnetPolarity?: string | null;
  pcbThickness?: string | null;
  imageUrl?: string | null;
  topHousingColor?: string | null;
  bottomHousingColor?: string | null;
  stemColor?: string | null;
  stemShape?: string | null;
  markings?: string | null;
  initialForce?: number | null;
  actuationForce?: number | null;
  tactileForce?: number | null;
  tactilePosition?: number | null;
  bottomOutForce?: number | null;
  progressiveSpring?: boolean | null;
  doubleStage?: boolean | null;
  clickType?: 'CLICK_LEAF' | 'CLICK_BAR' | 'CLICK_JACKET' | null;
  preTravel?: number | null;
  bottomOut?: number | null;
  initialMagneticFlux?: number | null;
  bottomOutMagneticFlux?: number | null;
  technology?: 'MECHANICAL' | 'OPTICAL' | 'MAGNETIC' | 'INDUCTIVE' | 'ELECTRO_CAPACITIVE' | null;
  type?: 'LINEAR' | 'TACTILE' | 'CLICKY' | 'SILENT_LINEAR' | 'SILENT_TACTILE' | 'MOUSE' | null;
  manufacturer?: string;
  primaryImageId?: string | null;
  images?: SwitchImage[];
}

function isValidMasterSwitchImageValue(value: string) {
  if (value.startsWith('/uploads/')) {
    return true;
  }

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

// Schema for edit suggestion - matching the submission form
const editSuggestionSchema = z.object({
  name: z.string().min(1, 'Switch name is required'),
  chineseName: z.string().optional().nullable().or(z.literal('')),
  manufacturer: z.string().min(1, 'Manufacturer is required'),
  type: z.enum(['LINEAR', 'TACTILE', 'CLICKY', 'SILENT_LINEAR', 'SILENT_TACTILE', 'MOUSE']).optional().nullable(),
  technology: z.enum(['MECHANICAL', 'OPTICAL', 'MAGNETIC', 'INDUCTIVE', 'ELECTRO_CAPACITIVE']).optional().nullable(),
  compatibility: z.string().optional().nullable().or(z.literal('')),
  
  // Force specifications
  initialForce: z.number().min(0).max(1000).optional().nullable().or(z.nan()),
  actuationForce: z.number().min(0).max(1000).optional().nullable().or(z.nan()),
  tactileForce: z.number().min(0).max(1000).optional().nullable().or(z.nan()),
  tactilePosition: z.number().min(0).max(10).optional().nullable().or(z.nan()),
  bottomOutForce: z.number().min(0).max(1000).optional().nullable().or(z.nan()),
  preTravel: z.number().min(0).max(10).optional().nullable().or(z.nan()),
  bottomOut: z.number().min(0).max(10).optional().nullable().or(z.nan()),
  
  // Spring specifications
  springWeight: z.string().optional().nullable().or(z.literal('')),
  springLength: z.string().optional().nullable().or(z.literal('')),
  progressiveSpring: z.boolean().optional().nullable(),
  doubleStage: z.boolean().optional().nullable(),
  clickType: z.enum(['CLICK_LEAF', 'CLICK_BAR', 'CLICK_JACKET']).optional().nullable(),
  
  // Materials
  topHousing: z.string().optional().nullable().or(z.literal('')),
  bottomHousing: z.string().optional().nullable().or(z.literal('')),
  stem: z.string().optional().nullable().or(z.literal('')),
  
  // Magnetic specifications
  magnetOrientation: z.string().optional().nullable().or(z.literal('')),
  magnetPosition: z.string().optional().nullable().or(z.literal('')),
  magnetPolarity: z.string().optional().nullable().or(z.literal('')),
  initialMagneticFlux: z.number().min(0).max(10000).optional().nullable().or(z.nan()),
  bottomOutMagneticFlux: z.number().min(0).max(10000).optional().nullable().or(z.nan()),
  pcbThickness: z.string().optional().nullable().or(z.literal('')),
  
  // Additional info
  notes: z.string().optional().nullable().or(z.literal('')),
  imageUrl: z.union([
    z.string().refine(
      (value) => value === '' || isValidMasterSwitchImageValue(value),
      'Invalid image URL or upload path'
    ),
    z.literal(''),
    z.null(),
  ]).optional(),
  
  // Color and shape fields
  topHousingColor: z.string().optional().nullable().or(z.literal('')),
  bottomHousingColor: z.string().optional().nullable().or(z.literal('')),
  stemColor: z.string().optional().nullable().or(z.literal('')),
  stemShape: z.string().optional().nullable().or(z.literal('')),
  markings: z.string().max(500).optional().nullable().or(z.literal('')),
  
  // Edit reason
  editReason: z.string().min(10, 'Please explain what you changed and why'),
});

type EditSuggestionData = z.infer<typeof editSuggestionSchema> & {
  changedFields?: string[];
};

interface MasterSwitchEditFormProps {
  currentData: MasterSwitchFormData;
  onSubmit: (data: EditSuggestionData) => Promise<void>;
  isSubmitting: boolean;
}

export function MasterSwitchEditForm({ currentData, onSubmit, isSubmitting }: MasterSwitchEditFormProps) {
  const [changedFields, setChangedFields] = useState<Set<string>>(new Set());
  const [showMagneticFields, setShowMagneticFields] = useState(
    currentData.technology === 'MAGNETIC'
  );
  const [materials, setMaterials] = useState<{ id: string; name: string }[]>([]);
  const [stemShapes, setStemShapes] = useState<{ id: string; name: string }[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showExternalImageField, setShowExternalImageField] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const currentPrimaryImageUrl = useMemo(() => {
    if (currentData.primaryImageId && currentData.images?.length) {
      const primaryImage = currentData.images.find((image) => image.id === currentData.primaryImageId);
      if (primaryImage?.url) {
        return primaryImage.url;
      }
    }

    if (currentData.images?.length) {
      return currentData.images[0].url;
    }

    return currentData.imageUrl || '';
  }, [currentData]);
  
  useEffect(() => {
    Promise.all([
      getMaterials().then(setMaterials),
      getStemShapes().then(setStemShapes)
    ]).then(() => {
      setDataLoaded(true);
    });
  }, []);
  
  // Clean initial data - convert null to empty string or undefined for form
  const cleanedInitialData: EditSuggestionData = {
    name: currentData.name || '',
    manufacturer: currentData.manufacturer || '',
    type: currentData.type || null,
    technology: currentData.technology || null,
    chineseName: currentData.chineseName || '',
    compatibility: currentData.compatibility || '',
    springWeight: currentData.springWeight || '',
    springLength: currentData.springLength || '',
    topHousing: currentData.topHousing || '',
    bottomHousing: currentData.bottomHousing || '',
    stem: currentData.stem || '',
    magnetOrientation: currentData.magnetOrientation || '',
    magnetPosition: currentData.magnetPosition || '',
    magnetPolarity: currentData.magnetPolarity || '',
    pcbThickness: currentData.pcbThickness || '',
    notes: currentData.notes || '',
    imageUrl: currentPrimaryImageUrl,
    topHousingColor: currentData.topHousingColor || '',
    bottomHousingColor: currentData.bottomHousingColor || '',
    stemColor: currentData.stemColor || '',
    stemShape: currentData.stemShape || '',
    markings: currentData.markings || '',
    initialForce: currentData.initialForce ?? undefined,
    actuationForce: currentData.actuationForce ?? undefined,
    tactileForce: currentData.tactileForce ?? undefined,
    tactilePosition: currentData.tactilePosition ?? undefined,
    bottomOutForce: currentData.bottomOutForce ?? undefined,
    progressiveSpring: currentData.progressiveSpring || false,
    doubleStage: currentData.doubleStage || false,
    clickType: currentData.clickType || null,
    preTravel: currentData.preTravel ?? undefined,
    bottomOut: currentData.bottomOut ?? undefined,
    initialMagneticFlux: currentData.initialMagneticFlux ?? undefined,
    bottomOutMagneticFlux: currentData.bottomOutMagneticFlux ?? undefined,
    editReason: '',
  };
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    getValues,
    setError,
    clearErrors,
  } = useForm<EditSuggestionData>({
    resolver: zodResolver(editSuggestionSchema),
    defaultValues: {
      ...cleanedInitialData,
    },
  });

  const manufacturerValue = watch('manufacturer');
  const technologyValue = watch('technology');
  const typeValue = watch('type');
  const watchedImageUrl = watch('imageUrl') || '';
  const showTactileForce = typeValue === 'TACTILE' || typeValue === 'SILENT_TACTILE' || typeValue === 'CLICKY';
  const showTactilePosition = typeValue === 'TACTILE' || typeValue === 'SILENT_TACTILE' || typeValue === 'CLICKY';
  const showClickType = typeValue === 'CLICKY';

  const imagePreviewUrl = watchedImageUrl || currentPrimaryImageUrl;
  const hasReplacementImage = watchedImageUrl !== currentPrimaryImageUrl;

  // Show magnetic fields when magnetic technology is selected
  if (technologyValue === 'MAGNETIC' && !showMagneticFields) {
    setShowMagneticFields(true);
  } else if (technologyValue !== 'MAGNETIC' && showMagneticFields) {
    setShowMagneticFields(false);
  }

  // Track field changes
  const handleFieldChange = (fieldName: string, newValue: any) => {
    const originalValue = (currentData as any)[fieldName];
    
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

  const handleSuggestedImageUpdate = (value: string) => {
    setValue('imageUrl', value, { shouldDirty: true, shouldValidate: true });
    handleFieldChange('imageUrl', value);
  };

  const uploadSuggestedImage = async (file: File) => {
    setImageUploadError(null);

    const allowedTypes = IMAGE_CONFIG.allowedMimeTypes as readonly string[];
    if (!allowedTypes.includes(file.type)) {
      const message = 'Invalid file type. Please upload a JPEG, PNG, WebP, or HEIC image.';
      setImageUploadError(message);
      setError('imageUrl', { type: 'manual', message });
      return;
    }

    if (file.size > IMAGE_CONFIG.maxFileSize) {
      const message = `File size must not exceed ${IMAGE_CONFIG.maxFileSize / 1024 / 1024}MB`;
      setImageUploadError(message);
      setError('imageUrl', { type: 'manual', message });
      return;
    }

    setIsUploadingImage(true);
    setImageUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          setImageUploadProgress(Math.round((event.loaded * 100) / event.total));
        }
      });

      const response = await new Promise<Response>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          resolve(new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: { 'Content-Type': 'application/json' },
          }));
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.open('POST', `/api/master-switches/${currentData.id}/suggest-edit/image`);
        xhr.send(formData);
      });

      const payload = await responseJsonBody(response) as { error?: string; url?: string } | null;
      if (!response.ok) {
        throw new Error(apiErrorMessage(payload, 'Upload failed'));
      }
      if (!payload?.url) throw new Error('Upload response was invalid');

      clearErrors('imageUrl');
      handleSuggestedImageUpdate(payload.url);

      if (imageInputRef.current) {
        imageInputRef.current.value = '';
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed';
      setImageUploadError(message);
      setError('imageUrl', { type: 'manual', message });
    } finally {
      setIsUploadingImage(false);
      setImageUploadProgress(0);
    }
  };

  const handleImageFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    await uploadSuggestedImage(file);
  };

  // Clean data before submission
  const handleFormSubmit = (data: EditSuggestionData) => {
    // Form submitted
    
    if (changedFields.size === 0) {
      alert('Please make at least one change before submitting');
      return;
    }
    
    // Convert NaN values to undefined for optional number fields
    const cleanedData = {
      ...data,
      initialForce: isNaN(data.initialForce as number) ? undefined : data.initialForce,
      actuationForce: isNaN(data.actuationForce as number) ? undefined : data.actuationForce,
      tactileForce: isNaN(data.tactileForce as number) ? undefined : data.tactileForce,
      bottomOutForce: isNaN(data.bottomOutForce as number) ? undefined : data.bottomOutForce,
      preTravel: isNaN(data.preTravel as number) ? undefined : data.preTravel,
      bottomOut: isNaN(data.bottomOut as number) ? undefined : data.bottomOut,
      initialMagneticFlux: isNaN(data.initialMagneticFlux as number) ? undefined : data.initialMagneticFlux,
      bottomOutMagneticFlux: isNaN(data.bottomOutMagneticFlux as number) ? undefined : data.bottomOutMagneticFlux,
      changedFields: Array.from(changedFields),
    };
    
    // Submitting cleaned data
    onSubmit(cleanedData);
  };

  // Form validation check
  if (Object.keys(errors).length > 0) {
    // Validation errors present
  }

  // Don't render form until materials and stem shapes are loaded
  if (!dataLoaded) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(handleFormSubmit as any)} className="space-y-6">
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
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Basic Information</h2>
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
              onChange={(e) => {
                register('chineseName').onChange(e);
                handleFieldChange('chineseName', e.target.value);
              }}
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
              Switch Type
            </label>
            <select
              {...register('type')}
              onChange={(e) => {
                register('type').onChange(e);
                handleFieldChange('type', e.target.value);
              }}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
            >
              <option value="">Select type</option>
              <option value="LINEAR">Linear</option>
              <option value="TACTILE">Tactile</option>
              <option value="CLICKY">Clicky</option>
              <option value="SILENT_LINEAR">Silent Linear</option>
              <option value="SILENT_TACTILE">Silent Tactile</option>
              <option value="MOUSE">Mouse</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Technology
            </label>
            <select
              {...register('technology')}
              onChange={(e) => {
                register('technology').onChange(e);
                handleFieldChange('technology', e.target.value);
              }}
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
              onChange={(e) => {
                register('compatibility').onChange(e);
                handleFieldChange('compatibility', e.target.value);
              }}
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
              onChange={(e) => {
                register('initialForce', { valueAsNumber: true }).onChange(e);
                handleFieldChange('initialForce', e.target.valueAsNumber);
              }}
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
              onChange={(e) => {
                register('actuationForce', { valueAsNumber: true }).onChange(e);
                handleFieldChange('actuationForce', e.target.valueAsNumber);
              }}
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
                onChange={(e) => {
                  register('tactileForce', { valueAsNumber: true }).onChange(e);
                  handleFieldChange('tactileForce', e.target.valueAsNumber);
                }}
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
                onChange={(e) => {
                  register('tactilePosition').onChange(e);
                  handleFieldChange('tactilePosition', e.target.value ? parseFloat(e.target.value) : null);
                }}
                type="number"
                step="0.1"
                min="0"
                max="10"
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
              onChange={(e) => {
                register('bottomOutForce', { valueAsNumber: true }).onChange(e);
                handleFieldChange('bottomOutForce', e.target.valueAsNumber);
              }}
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
              onChange={(e) => {
                register('preTravel', { valueAsNumber: true }).onChange(e);
                handleFieldChange('preTravel', e.target.valueAsNumber);
              }}
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
              onChange={(e) => {
                register('bottomOut', { valueAsNumber: true }).onChange(e);
                handleFieldChange('bottomOut', e.target.valueAsNumber);
              }}
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
              onChange={(e) => {
                register('springWeight').onChange(e);
                handleFieldChange('springWeight', e.target.value);
              }}
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
              onChange={(e) => {
                register('springLength').onChange(e);
                handleFieldChange('springLength', e.target.value);
              }}
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
              onChange={(e) => {
                register('progressiveSpring').onChange(e);
                handleFieldChange('progressiveSpring', e.target.checked);
              }}
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
              onChange={(e) => {
                register('doubleStage').onChange(e);
                handleFieldChange('doubleStage', e.target.checked);
              }}
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
              onChange={(e) => {
                register('clickType').onChange(e);
                handleFieldChange('clickType', e.target.value || null);
              }}
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
            <select
              {...register('topHousing')}
              onChange={(e) => {
                register('topHousing').onChange(e);
                handleFieldChange('topHousing', e.target.value);
              }}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2"
            >
              <option value="">Select material (optional)</option>
              {materials.map(material => (
                <option key={material.id} value={material.name}>
                  {material.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bottom Housing
            </label>
            <select
              {...register('bottomHousing')}
              onChange={(e) => {
                register('bottomHousing').onChange(e);
                handleFieldChange('bottomHousing', e.target.value);
              }}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2"
            >
              <option value="">Select material (optional)</option>
              {materials.map(material => (
                <option key={material.id} value={material.name}>
                  {material.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stem
            </label>
            <select
              {...register('stem')}
              onChange={(e) => {
                register('stem').onChange(e);
                handleFieldChange('stem', e.target.value);
              }}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2"
            >
              <option value="">Select material (optional)</option>
              {materials.map(material => (
                <option key={material.id} value={material.name}>
                  {material.name}
                </option>
              ))}
            </select>
          </div>
        </div>
        
        {/* Color fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Top Housing Color
            </label>
            <input
              {...register('topHousingColor')}
              onChange={(e) => {
                register('topHousingColor').onChange(e);
                handleFieldChange('topHousingColor', e.target.value);
              }}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="e.g., Clear, Black, White"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bottom Housing Color
            </label>
            <input
              {...register('bottomHousingColor')}
              onChange={(e) => {
                register('bottomHousingColor').onChange(e);
                handleFieldChange('bottomHousingColor', e.target.value);
              }}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="e.g., Black, Red, Blue"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stem Color
            </label>
            <input
              {...register('stemColor')}
              onChange={(e) => {
                register('stemColor').onChange(e);
                handleFieldChange('stemColor', e.target.value);
              }}
              type="text"
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="e.g., Red, Black, Purple"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Stem Shape
            </label>
            <select
              {...register('stemShape')}
              onChange={(e) => {
                register('stemShape').onChange(e);
                handleFieldChange('stemShape', e.target.value);
              }}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2"
            >
              <option value="">Select shape (optional)</option>
              {stemShapes.map(shape => (
                <option key={shape.id} value={shape.name}>
                  {shape.name}
                </option>
              ))}
            </select>
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
                onChange={(e) => {
                  register('initialMagneticFlux', { valueAsNumber: true }).onChange(e);
                  handleFieldChange('initialMagneticFlux', e.target.valueAsNumber);
                }}
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
                onChange={(e) => {
                  register('bottomOutMagneticFlux', { valueAsNumber: true }).onChange(e);
                  handleFieldChange('bottomOutMagneticFlux', e.target.valueAsNumber);
                }}
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
                onChange={(e) => {
                  register('magnetOrientation').onChange(e);
                  handleFieldChange('magnetOrientation', e.target.value);
                }}
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
                onChange={(e) => {
                  register('magnetPosition').onChange(e);
                  handleFieldChange('magnetPosition', e.target.value);
                }}
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
                onChange={(e) => {
                  register('pcbThickness').onChange(e);
                  handleFieldChange('pcbThickness', e.target.value);
                }}
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
                onChange={(e) => {
                  register('magnetPolarity').onChange(e);
                  handleFieldChange('magnetPolarity', e.target.value);
                }}
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
              onChange={(e) => {
                register('notes').onChange(e);
                handleFieldChange('notes', e.target.value);
              }}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Any additional information about the switch..."
            />
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Switch Image
              </label>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                See the current image, then upload a replacement or add one if it is missing.
              </p>
            </div>

            {imagePreviewUrl ? (
              <div className="flex flex-col gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {hasReplacementImage ? 'Suggested replacement image' : 'Current image'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 break-all">
                      {imagePreviewUrl}
                    </p>
                  </div>
                  {hasReplacementImage && (
                    <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
                      Pending suggestion
                    </span>
                  )}
                </div>
                <div className="overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-900">
                  <img
                    src={imagePreviewUrl}
                    alt={`${currentData.name || 'Switch'} preview`}
                    className="h-48 w-full object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-600 p-6 text-sm text-gray-500 dark:text-gray-400">
                No image is currently attached to this master switch.
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <input
                ref={imageInputRef}
                type="file"
                accept={IMAGE_CONFIG.allowedMimeTypes.join(',')}
                onChange={handleImageFileSelect}
                disabled={isUploadingImage}
                className="hidden"
                id="master-switch-suggestion-image-upload"
              />
              <label
                htmlFor="master-switch-suggestion-image-upload"
                className={`inline-flex cursor-pointer items-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 ${
                  isUploadingImage ? 'cursor-not-allowed opacity-50' : ''
                }`}
              >
                {isUploadingImage
                  ? `Uploading... ${imageUploadProgress}%`
                  : imagePreviewUrl
                    ? 'Replace Image'
                    : 'Upload Image'}
              </label>
              {hasReplacementImage && (
                <button
                  type="button"
                  onClick={() => {
                    clearErrors('imageUrl');
                    setImageUploadError(null);
                    handleSuggestedImageUpdate(currentPrimaryImageUrl);
                  }}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
                >
                  Revert to Current
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowExternalImageField((value) => !value)}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                {showExternalImageField ? 'Hide URL Field' : 'Use Image URL Instead'}
              </button>
            </div>

            {showExternalImageField && (
              <div>
                <input
                  {...register('imageUrl')}
                  onChange={(e) => {
                    register('imageUrl').onChange(e);
                    handleFieldChange('imageUrl', e.target.value);
                    setImageUploadError(null);
                  }}
                  type="text"
                  className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
                  placeholder="https://example.com/switch-image.jpg or /uploads/..."
                />
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                  Optional fallback if you want to link an external image manually.
                </p>
              </div>
            )}

            {errors.imageUrl && (
              <p className="text-sm text-red-600 dark:text-red-400">{errors.imageUrl.message}</p>
            )}
            {!errors.imageUrl && imageUploadError && (
              <p className="text-sm text-red-600 dark:text-red-400">{imageUploadError}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Markings
            </label>
            <textarea
              {...register('markings')}
              onChange={(e) => {
                register('markings').onChange(e);
                handleFieldChange('markings', e.target.value);
              }}
              rows={3}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Describe any identifying markings on the switch housing (e.g., Cherry logo, version numbers, etc.)"
            />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Add any identifying markings on the switch housing
            </p>
          </div>
        </div>
      </div>

      {/* Edit Reason */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Edit Details</h2>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            What did you change and why? <span className="text-red-500">*</span>
          </label>
          <textarea
            {...register('editReason')}
            rows={4}
            className="w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 px-3 py-2 placeholder-gray-400 dark:placeholder-gray-500"
            placeholder="Please explain what information you've updated and provide any sources or references for your changes..."
          />
          {errors.editReason && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errors.editReason.message}</p>
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
