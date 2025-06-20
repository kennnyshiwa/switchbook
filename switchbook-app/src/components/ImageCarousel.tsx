'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'

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
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (isHovered && images.length > 1) {
      // Start cycling through images
      intervalRef.current = setInterval(() => {
        setCurrentIndex((prev) => (prev + 1) % images.length)
      }, 1000) // Change image every second
    } else {
      // Stop cycling and reset to first image
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setCurrentIndex(0)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [isHovered, images.length])

  // Determine which image to show
  let imageUrl: string | null = null
  
  if (images.length > 0) {
    const currentImage = images[currentIndex]
    imageUrl = currentImage.thumbnailUrl || currentImage.url
  } else if (fallbackImage) {
    imageUrl = fallbackImage
  }

  if (!imageUrl) {
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
    <div className={`${className} relative overflow-hidden`}>
      <Image
        src={imageUrl}
        alt={alt}
        fill
        className="object-cover transition-opacity duration-300"
        sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
      />
      
      {/* Image indicators */}
      {isHovered && images.length > 1 && (
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1">
          {images.map((_, index) => (
            <div
              key={index}
              className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'bg-white w-3'
                  : 'bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
      
      {/* Image count badge */}
      {images.length > 1 && !isHovered && (
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