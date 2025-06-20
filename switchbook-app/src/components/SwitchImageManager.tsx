'use client'

import { useState, useEffect } from 'react'
import Image from 'next/image'
import ImageUpload from './ImageUpload'
import { IMAGE_CONFIG } from '@/lib/image-config'

interface SwitchImage {
  id: string
  url: string
  type: 'UPLOADED' | 'LINKED'
  order: number
  caption?: string | null
  thumbnailUrl?: string
  mediumUrl?: string
}

interface SwitchImageManagerProps {
  switchId: string
  images: SwitchImage[]
  onImagesUpdated: (images: SwitchImage[]) => void
  editable?: boolean
}

export default function SwitchImageManager({
  switchId,
  images: initialImages,
  onImagesUpdated,
  editable = true
}: SwitchImageManagerProps) {
  const [images, setImages] = useState<SwitchImage[]>(initialImages)
  const [editingCaption, setEditingCaption] = useState<string | null>(null)
  const [captionText, setCaptionText] = useState('')
  const [isReordering, setIsReordering] = useState(false)
  const [draggedImage, setDraggedImage] = useState<string | null>(null)
  const [addingUrl, setAddingUrl] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [urlError, setUrlError] = useState<string | null>(null)

  useEffect(() => {
    setImages(initialImages)
  }, [initialImages])

  const handleImageUploaded = async (uploadedImage: any) => {
    const newImages = [...images, uploadedImage]
    setImages(newImages)
    onImagesUpdated(newImages)
  }

  const handleDeleteImage = async (imageId: string) => {
    if (!confirm('Are you sure you want to delete this image?')) return

    try {
      const response = await fetch(`/api/switches/${switchId}/images?imageId=${imageId}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        throw new Error('Failed to delete image')
      }

      const newImages = images.filter(img => img.id !== imageId)
      setImages(newImages)
      onImagesUpdated(newImages)
    } catch (error) {
      alert('Failed to delete image')
    }
  }

  const handleUpdateCaption = async (imageId: string) => {
    try {
      const response = await fetch(`/api/switches/${switchId}/images/${imageId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: captionText })
      })

      if (!response.ok) {
        throw new Error('Failed to update caption')
      }

      const updatedImage = await response.json()
      const newImages = images.map(img => 
        img.id === imageId ? { ...img, caption: updatedImage.caption } : img
      )
      setImages(newImages)
      onImagesUpdated(newImages)
      setEditingCaption(null)
      setCaptionText('')
    } catch (error) {
      alert('Failed to update caption')
    }
  }

  const handleDragStart = (imageId: string) => {
    setDraggedImage(imageId)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    if (!draggedImage) return

    const draggedIndex = images.findIndex(img => img.id === draggedImage)
    if (draggedIndex === targetIndex) return

    // Reorder images
    const newImages = [...images]
    const [removed] = newImages.splice(draggedIndex, 1)
    newImages.splice(targetIndex, 0, removed)

    // Update order values
    const reorderedImages = newImages.map((img, index) => ({
      ...img,
      order: index
    }))

    setImages(reorderedImages)
    setDraggedImage(null)

    // Save new order
    try {
      const response = await fetch(`/api/switches/${switchId}/images/reorder`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: reorderedImages.map(img => ({ id: img.id, order: img.order }))
        })
      })

      if (!response.ok) {
        throw new Error('Failed to reorder images')
      }

      onImagesUpdated(reorderedImages)
    } catch (error) {
      alert('Failed to save image order')
      // Revert on error
      setImages(initialImages)
    }
  }

  const handleAddUrl = async () => {
    setUrlError(null)

    try {
      const response = await fetch(`/api/switches/${switchId}/images/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: urlInput })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to add image')
      }

      const newImage = await response.json()
      const newImages = [...images, newImage]
      setImages(newImages)
      onImagesUpdated(newImages)
      setAddingUrl(false)
      setUrlInput('')
    } catch (error) {
      setUrlError(error instanceof Error ? error.message : 'Failed to add image')
    }
  }

  const getImageUrl = (image: SwitchImage, size: 'thumb' | 'medium' | 'original' = 'thumb') => {
    if (size === 'thumb' && image.thumbnailUrl) return image.thumbnailUrl
    if (size === 'medium' && image.mediumUrl) return image.mediumUrl
    return image.url
  }

  return (
    <div className="space-y-4">
      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {images.map((image, index) => (
            <div
              key={image.id}
              className={`relative group ${isReordering ? 'cursor-move' : ''}`}
              draggable={isReordering}
              onDragStart={() => handleDragStart(image.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, index)}
            >
              <div className="aspect-square relative overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                <Image
                  src={getImageUrl(image, 'thumb')}
                  alt={image.caption || `Image ${index + 1}`}
                  fill
                  className="object-cover"
                  sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
                />
                
                {/* Type badge */}
                {image.type === 'LINKED' && (
                  <div className="absolute top-2 left-2 px-2 py-1 bg-blue-600 text-white text-xs rounded">
                    External
                  </div>
                )}

                {/* Action buttons */}
                {editable && !isReordering && (
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-opacity duration-200 flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <button
                      onClick={() => handleDeleteImage(image.id)}
                      className="p-2 bg-red-600 text-white rounded-full hover:bg-red-700 mx-1"
                      title="Delete image"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setEditingCaption(image.id)
                        setCaptionText(image.caption || '')
                      }}
                      className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 mx-1"
                      title="Edit caption"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  </div>
                )}

                {/* Order number when reordering */}
                {isReordering && (
                  <div className="absolute top-2 right-2 w-8 h-8 bg-gray-900 text-white rounded-full flex items-center justify-center font-bold">
                    {index + 1}
                  </div>
                )}
              </div>

              {/* Caption */}
              {editingCaption === image.id ? (
                <div className="mt-2">
                  <input
                    type="text"
                    value={captionText}
                    onChange={(e) => setCaptionText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleUpdateCaption(image.id)
                      } else if (e.key === 'Escape') {
                        setEditingCaption(null)
                        setCaptionText('')
                      }
                    }}
                    className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                    placeholder="Add caption..."
                    autoFocus
                  />
                  <div className="flex gap-2 mt-1">
                    <button
                      onClick={() => handleUpdateCaption(image.id)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingCaption(null)
                        setCaptionText('')
                      }}
                      className="text-xs text-gray-600 dark:text-gray-400 hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                image.caption && (
                  <p className="mt-1 text-xs text-gray-600 dark:text-gray-400 truncate">
                    {image.caption}
                  </p>
                )
              )}
            </div>
          ))}
        </div>
      )}

      {/* Controls */}
      {editable && (
        <div className="space-y-4">
          {/* Upload new image */}
          <ImageUpload
            switchId={switchId}
            onImageUploaded={handleImageUploaded}
            disabled={images.length >= IMAGE_CONFIG.maxImagesPerSwitch}
          />
          
          {images.length >= IMAGE_CONFIG.maxImagesPerSwitch && (
            <p className="text-sm text-amber-600 dark:text-amber-400">
              Maximum of {IMAGE_CONFIG.maxImagesPerSwitch} images allowed per switch
            </p>
          )}

          {/* Add URL */}
          <div>
            {!addingUrl ? (
              <button
                onClick={() => setAddingUrl(true)}
                disabled={images.length >= IMAGE_CONFIG.maxImagesPerSwitch}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add image from URL
              </button>
            ) : (
              <div className="space-y-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
                />
                {urlError && (
                  <p className="text-sm text-red-600 dark:text-red-400">{urlError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={handleAddUrl}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => {
                      setAddingUrl(false)
                      setUrlInput('')
                      setUrlError(null)
                    }}
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Reorder button */}
          {images.length > 1 && (
            <button
              onClick={() => setIsReordering(!isReordering)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                isReordering
                  ? 'bg-green-600 text-white hover:bg-green-700'
                  : 'bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-400 dark:hover:bg-gray-500'
              }`}
            >
              {isReordering ? 'Done Reordering' : 'Reorder Images'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}