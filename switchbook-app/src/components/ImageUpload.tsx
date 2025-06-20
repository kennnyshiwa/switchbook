'use client'

import { useState, useRef } from 'react'
import { IMAGE_CONFIG } from '@/lib/image-config'

interface ImageUploadProps {
  switchId: string
  onImageUploaded: (image: any) => void
  disabled?: boolean
}

export default function ImageUpload({ switchId, onImageUploaded, disabled = false }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setError(null)

    // Validate file type
    const allowedTypes = IMAGE_CONFIG.allowedMimeTypes as readonly string[]
    if (!allowedTypes.includes(file.type)) {
      setError('Invalid file type. Please upload a JPEG, PNG, WebP, or HEIC image.')
      return
    }

    // Validate file size
    if (file.size > IMAGE_CONFIG.maxFileSize) {
      setError(`File size must not exceed ${IMAGE_CONFIG.maxFileSize / 1024 / 1024}MB`)
      return
    }

    await uploadFile(file)
  }

  const uploadFile = async (file: File) => {
    setIsUploading(true)
    setUploadProgress(0)

    try {
      const formData = new FormData()
      formData.append('file', file)

      // Create XMLHttpRequest to track upload progress
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded * 100) / e.total)
          setUploadProgress(progress)
        }
      })

      const response = await new Promise<Response>((resolve, reject) => {
        xhr.addEventListener('load', () => {
          resolve(new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: {
              'Content-Type': 'application/json'
            }
          }))
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'))
        })

        xhr.open('POST', `/api/switches/${switchId}/images`)
        xhr.send(formData)
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Upload failed')
      }

      const uploadedImage = await response.json()
      onImageUploaded(uploadedImage)

      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const file = e.dataTransfer.files[0]
    if (file && !disabled && !isUploading) {
      // Directly validate and upload the file
      setError(null)
      
      // Validate file type
      const allowedTypes = IMAGE_CONFIG.allowedMimeTypes as readonly string[]
      if (!allowedTypes.includes(file.type)) {
        setError('Invalid file type. Please upload a JPEG, PNG, WebP, or HEIC image.')
        return
      }
      
      // Validate file size
      if (file.size > IMAGE_CONFIG.maxFileSize) {
        setError(`File size must not exceed ${IMAGE_CONFIG.maxFileSize / 1024 / 1024}MB`)
        return
      }
      
      uploadFile(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div className="w-full">
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        className={`relative border-2 border-dashed rounded-lg p-6 text-center ${
          disabled || isUploading
            ? 'border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 cursor-not-allowed'
            : 'border-gray-400 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_CONFIG.allowedMimeTypes.join(',')}
          onChange={handleFileSelect}
          disabled={disabled || isUploading}
          className="hidden"
          id="image-upload"
        />
        
        <label
          htmlFor="image-upload"
          className={`block ${disabled || isUploading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        >
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {isUploading ? (
              'Uploading...'
            ) : (
              <>
                <span className="font-medium">Click to upload</span> or drag and drop
              </>
            )}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            JPEG, PNG, WebP, HEIC up to {IMAGE_CONFIG.maxFileSize / 1024 / 1024}MB
          </p>
        </label>

        {/* Progress bar */}
        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-900 bg-opacity-90 dark:bg-opacity-90 rounded-lg">
            <div className="w-3/4">
              <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 text-center mt-2">
                {uploadProgress}%
              </p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}