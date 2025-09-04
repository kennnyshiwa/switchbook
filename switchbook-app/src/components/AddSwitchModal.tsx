'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { switchSchema } from '@/lib/validation'
import { Switch } from '@prisma/client'
import SwitchForm from './SwitchForm'
import MasterSwitchSuggestions from './MasterSwitchSuggestions'

type SwitchFormData = z.infer<typeof switchSchema>

interface SwitchImage {
  id: string
  url: string
  type: 'UPLOADED' | 'LINKED'
  order: number
  caption?: string | null
  thumbnailUrl?: string
  mediumUrl?: string
}

interface ExtendedSwitch extends Switch {
  images?: SwitchImage[]
}

interface AddSwitchModalProps {
  userId: string
  onClose: () => void
  onSwitchAdded: (newSwitch: ExtendedSwitch) => void
}

interface PendingImage {
  id: string
  file?: File
  url: string
  type: 'UPLOADED' | 'LINKED'
  caption?: string
}

export default function AddSwitchModal({ userId, onClose, onSwitchAdded }: AddSwitchModalProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showFrankenswitch, setShowFrankenswitch] = useState(false)
  const [selectedMasterSwitchId, setSelectedMasterSwitchId] = useState<string | null>(null)
  const [showFromMasterBanner, setShowFromMasterBanner] = useState(false)
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [uploadProgress, setUploadProgress] = useState<string | null>(null)
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [captionText, setCaptionText] = useState('')
  const [addingUrl, setAddingUrl] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SwitchFormData>({
    resolver: zodResolver(switchSchema) as any,
    defaultValues: {
      personalTags: [],
    }
  })

  const switchName = watch('name')

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      pendingImages.forEach(img => {
        if (img.type === 'UPLOADED' && img.file) {
          URL.revokeObjectURL(img.url)
        }
      })
    }
  }, [])

  const handleImageUploaded = (uploadedImage: any) => {
    // For the AddSwitchModal, we'll handle file uploads manually
    // This is just a placeholder since we can't use the ImageUpload component
    // without a switchId
  }
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    
    const newImages: PendingImage[] = Array.from(files).map((file, index) => ({
      id: `pending-${Date.now()}-${index}`,
      file,
      url: URL.createObjectURL(file),
      type: 'UPLOADED' as const,
      caption: ''
    }))
    setPendingImages(prev => [...prev, ...newImages])
  }

  const handleAddUrl = () => {
    if (!urlInput.trim()) {
      setUrlError('Please enter a valid URL')
      return
    }

    try {
      new URL(urlInput)
    } catch {
      setUrlError('Please enter a valid URL')
      return
    }

    const newImage: PendingImage = {
      id: `pending-url-${Date.now()}`,
      url: urlInput,
      type: 'LINKED' as const,
      caption: ''
    }
    
    setPendingImages(prev => [...prev, newImage])
    setUrlInput('')
    setAddingUrl(false)
    setUrlError(null)
  }

  const handleDeleteImage = (imageId: string) => {
    const image = pendingImages.find(img => img.id === imageId)
    if (image && image.type === 'UPLOADED' && image.file) {
      URL.revokeObjectURL(image.url)
    }
    setPendingImages(prev => prev.filter(img => img.id !== imageId))
  }

  const handleUpdateCaption = (imageId: string) => {
    setPendingImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, caption: captionText } : img
    ))
    setEditingCaption(null)
    setCaptionText('')
  }

  const uploadImages = async (switchId: string) => {
    if (pendingImages.length === 0) return

    setUploadProgress('Uploading images...')
    
    for (let i = 0; i < pendingImages.length; i++) {
      const image = pendingImages[i]
      
      if (image.type === 'UPLOADED' && image.file) {
        const formData = new FormData()
        formData.append('file', image.file)
        formData.append('switchId', switchId)
        formData.append('order', i.toString())
        if (image.caption) {
          formData.append('caption', image.caption)
        }

        try {
          const response = await fetch(`/api/switches/${switchId}/images`, {
            method: 'POST',
            body: formData,
          })

          if (!response.ok) {
            console.error('Failed to upload image')
          }
        } catch (error) {
          console.error('Error uploading image:', error)
        }
      } else if (image.type === 'LINKED') {
        try {
          const response = await fetch(`/api/switches/${switchId}/images/link`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              url: image.url,
              caption: image.caption
            })
          })

          if (!response.ok) {
            console.error('Failed to link image')
          }
        } catch (error) {
          console.error('Error linking image:', error)
        }
      }
    }
  }

  const onSubmit = async (data: SwitchFormData) => {
    setIsLoading(true)
    setError(null)

    try {
      // Include masterSwitchId if selected from master database
      const submitData = selectedMasterSwitchId 
        ? { ...data, masterSwitchId: selectedMasterSwitchId }
        : data

      const response = await fetch('/api/switches', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData),
      })

      if (!response.ok) {
        throw new Error('Failed to create switch')
      }

      const newSwitch = await response.json()

      // Upload images if any
      if (pendingImages.length > 0) {
        await uploadImages(newSwitch.id)
        // Fetch the updated switch with images
        const updatedResponse = await fetch(`/api/switches/${newSwitch.id}`)
        if (updatedResponse.ok) {
          const updatedSwitch = await updatedResponse.json()
          onSwitchAdded(updatedSwitch)
        } else {
          onSwitchAdded(newSwitch)
        }
      } else {
        onSwitchAdded(newSwitch)
      }
    } catch (error) {
      setError('Failed to create switch. Please try again.')
    } finally {
      setIsLoading(false)
      setUploadProgress(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-gray-500 dark:bg-gray-900 bg-opacity-75 dark:bg-opacity-80 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
          <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Add New Switch</h3>
          <div className="flex items-center space-x-2">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showFrankenswitch}
                onChange={(e) => setShowFrankenswitch(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">Frankenswitch</span>
            </label>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
          {error && (
            <div className="rounded-md bg-red-50 dark:bg-red-900/20 p-4">
              <p className="text-sm text-red-800 dark:text-red-400">{error}</p>
            </div>
          )}

          {showFromMasterBanner && (
            <div className="rounded-md bg-purple-50 dark:bg-purple-900/20 p-4 mb-4">
              <div className="flex items-center">
                <span className="inline-flex items-center justify-center w-6 h-6 bg-purple-600 text-white text-xs font-bold rounded-full mr-3">
                  M
                </span>
                <div className="flex-1">
                  <p className="text-sm text-purple-800 dark:text-purple-200 font-medium">
                    Adding from Master Database
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    This switch will be linked to the master database for automatic updates
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedMasterSwitchId(null)
                    setShowFromMasterBanner(false)
                  }}
                  className="text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
                  title="Remove master database link"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          <div className="relative">
            <SwitchForm 
              register={register} 
              errors={errors} 
              setValue={setValue} 
              watch={watch} 
              showFrankenswitch={showFrankenswitch} 
              isLinkedToMaster={!!selectedMasterSwitchId}
            />
            
            {/* Show suggestions when typing switch name */}
            {switchName && switchName.length >= 2 && !selectedMasterSwitchId && (
              <div style={{ position: 'absolute', top: '65px', left: 0, right: 0, zIndex: 50 }}>
                <MasterSwitchSuggestions
                  searchQuery={switchName}
                  setValue={setValue}
                  onSelectSwitch={(masterSwitch) => {
                    setSelectedMasterSwitchId(masterSwitch.id)
                    setShowFromMasterBanner(true)
                  }}
                />
              </div>
            )}
          </div>

          {/* Image Manager Section */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Images</h3>
            
            {/* Upload and Link buttons */}
            <div className="flex space-x-2 mb-4">
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="sr-only"
                />
                <span className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload Images
                </span>
              </label>
              <button
                type="button"
                onClick={() => setAddingUrl(true)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
              >
                Link from URL
              </button>
            </div>

            {/* URL input */}
            {addingUrl && (
              <div className="mb-4 p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex space-x-2">
                  <input
                    type="url"
                    value={urlInput}
                    onChange={(e) => {
                      setUrlInput(e.target.value)
                      setUrlError(null)
                    }}
                    placeholder="https://example.com/image.jpg"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                  />
                  <button
                    type="button"
                    onClick={handleAddUrl}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingUrl(false)
                      setUrlInput('')
                      setUrlError(null)
                    }}
                    className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
                {urlError && (
                  <p className="mt-2 text-sm text-red-600 dark:text-red-400">{urlError}</p>
                )}
              </div>
            )}

            {/* Image grid */}
            {pendingImages.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {pendingImages.map((image) => (
                  <div key={image.id} className="relative group">
                    <div className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden">
                      <img
                        src={image.url}
                        alt=""
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.src = '/placeholder-image.png'
                        }}
                      />
                    </div>
                    
                    {/* Image actions */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => handleDeleteImage(image.id)}
                        className="p-1 bg-red-600 text-white rounded hover:bg-red-700"
                        title="Delete image"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    {/* Caption */}
                    <div className="mt-2">
                      {editingCaption === image.id ? (
                        <div className="flex space-x-1">
                          <input
                            type="text"
                            value={captionText}
                            onChange={(e) => setCaptionText(e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700"
                            placeholder="Add caption..."
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleUpdateCaption(image.id)
                              } else if (e.key === 'Escape') {
                                setEditingCaption(null)
                                setCaptionText('')
                              }
                            }}
                            autoFocus
                          />
                          <button
                            type="button"
                            onClick={() => handleUpdateCaption(image.id)}
                            className="p-1 text-green-600 hover:text-green-700"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </button>
                        </div>
                      ) : (
                        <p
                          className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-gray-200"
                          onClick={() => {
                            setEditingCaption(image.id)
                            setCaptionText(image.caption || '')
                          }}
                        >
                          {image.caption || <span className="italic">Add caption...</span>}
                        </p>
                      )}
                    </div>

                    {/* Type badge */}
                    <div className="absolute top-2 left-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded ${
                        image.type === 'UPLOADED' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                          : 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                      }`}>
                        {image.type === 'UPLOADED' ? 'Upload' : 'Link'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {pendingImages.length === 0 && (
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-8">
                No images added yet. Upload or link images to showcase your switch.
              </p>
            )}
          </div>

          {uploadProgress && (
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
              {uploadProgress}
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 dark:bg-blue-500 border border-transparent rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? (uploadProgress || 'Creating...') : 'Create Switch'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}