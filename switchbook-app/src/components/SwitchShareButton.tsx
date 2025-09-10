'use client'

import { useState, useEffect } from 'react'

interface SwitchShareButtonProps {
  switchId: string
  shareableId: string | null | undefined
  className?: string
  iconOnly?: boolean
}

export default function SwitchShareButton({ 
  switchId, 
  shareableId: initialShareableId, 
  className,
  iconOnly = false 
}: SwitchShareButtonProps) {
  const [shareableId, setShareableId] = useState(initialShareableId)
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  
  // Update shareableId when prop changes
  useEffect(() => {
    setShareableId(initialShareableId)
  }, [initialShareableId])

  const handleShareClick = async () => {
    setIsLoading(true)
    setMessage(null)
    
    try {
      let currentShareableId = shareableId
      
      // If no share link exists, generate one first
      if (!currentShareableId) {
        const response = await fetch(`/api/switches/${switchId}/share`, {
          method: 'POST',
        })
        
        if (!response.ok) {
          throw new Error('Failed to generate share link')
        }
        
        const data = await response.json()
        currentShareableId = data.shareableId
        setShareableId(currentShareableId)
      }
      
      // Copy the share URL to clipboard
      const shareUrl = `${window.location.origin}/share/user-switch/${currentShareableId}`
      await navigator.clipboard.writeText(shareUrl)
      
      setMessage('Link copied!')
      setTimeout(() => setMessage(null), 2000)
    } catch (error) {
      setMessage('Failed to copy link')
      setTimeout(() => setMessage(null), 3000)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <button
      onClick={handleShareClick}
      disabled={isLoading}
      className={className || "text-indigo-600 hover:text-indigo-800 disabled:opacity-50"}
      title={message || "Share switch"}
    >
      {message === 'Link copied!' ? (
        // Show checkmark when successfully copied
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ) : message === 'Failed to copy link' ? (
        // Show X when failed
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      ) : (
        // Show share icon normally
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m9.632 4.268C17.886 14.938 17 14.482 17 14c0-.482.114-.938.316-1.342m0 2.684a3 3 0 110-2.684M9 20a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2zM9 8a1 1 0 100-2 1 1 0 000 2zm6 0a1 1 0 100-2 1 1 0 000 2z"
          />
        </svg>
      )}
      {!iconOnly && message && <span className="ml-1">{message}</span>}
    </button>
  )
}