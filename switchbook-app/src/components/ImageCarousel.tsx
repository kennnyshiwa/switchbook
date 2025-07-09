'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { getImageUrl } from '@/utils/imageHelpers'

interface SwitchImage {
  id: string
  url: string
  thumbnailUrl?: string
}

interface ImageCarouselProps {
  images: SwitchImage[]
  fallbackImage?: string | null
  alt: string
  isHovered: boolean
  className?: string
}

export default function ImageCarousel({ 
  images, 
  fallbackImage, 
  alt, 
  isHovered,
  className = ''
}: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [imageError, setImageError] = useState(false)
  
  // Ensure currentIndex is within bounds
  const safeCurrentIndex = images.length > 0 
    ? Math.min(currentIndex, images.length - 1) 
    : 0
  
  // Manual navigation functions
  const goToPrevious = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the gallery
    setCurrentIndex((prev) => (prev - 1 + images.length) % images.length)
  }
  
  const goToNext = (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent triggering the gallery
    setCurrentIndex((prev) => (prev + 1) % images.length)
  }

  // Reset error state when images change
  useEffect(() => {
    setImageError(false)
  }, [images, currentIndex])

  // Determine which image to show
  let imageUrl: string | null = null
  const hasImages = images && images.length > 0
  
  if (hasImages && !imageError) {
    const currentImage = images[safeCurrentIndex]
    if (currentImage) {
      const rawUrl = currentImage.thumbnailUrl || currentImage.url
      imageUrl = getImageUrl(rawUrl)
    }
  }

  if (!imageUrl || imageError) {
    return (
      <div className={`${className} bg-gray-200 dark:bg-gray-700 flex items-center justify-center`}>
        <svg
          className="w-12 h-12 text-gray-400 dark:text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      </div>
    )
  }

  return (
    <div className={`relative ${className} overflow-hidden group`}>
      <img
        src={imageUrl}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="w-full h-full object-contain transition-opacity duration-300"
        onLoad={() => {
          // Image loaded successfully
        }}
        onError={(e) => {
          if (images.length > 1) {
            // If we have multiple images and current one failed, try next
            setCurrentIndex((prev) => (prev + 1) % images.length)
          } else {
            // Only one image or no images, set error
            setImageError(true)
          }
        }}
      />
      
      {/* Navigation arrows - only show when hovering and multiple images */}
      {isHovered && hasImages && images.length > 1 && (
        <>
          <button
            onClick={goToPrevious}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all duration-200 opacity-0 group-hover:opacity-100"
            aria-label="Previous image"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            onClick={goToNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-all duration-200 opacity-0 group-hover:opacity-100"
            aria-label="Next image"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </>
      )}
      
      {/* Image indicators */}
      {isHovered && hasImages && images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 z-10 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {images.map((_, index) => (
            <button
              key={index}
              onClick={(e) => {
                e.stopPropagation()
                setCurrentIndex(index)
              }}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'bg-white w-6'
                  : 'bg-white/50 w-1.5 hover:bg-white/75'
              }`}
              aria-label={`Go to image ${index + 1}`}
            />
          ))}
        </div>
      )}
      
      {/* Image count badge - only show when not hovering */}
      {hasImages && images.length > 1 && !isHovered && (
        <div className="absolute top-2 right-2 px-2 py-1 bg-black/60 text-white text-xs rounded-full flex items-center space-x-1">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>{images.length}</span>
        </div>
      )}
    </div>
  )
}