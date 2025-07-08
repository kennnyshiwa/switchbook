'use client'

import { useState } from 'react'

interface MasterSwitchShareButtonProps {
  shareableId: string | null | undefined
  className?: string
}

export default function MasterSwitchShareButton({ shareableId, className }: MasterSwitchShareButtonProps) {
  const [copied, setCopied] = useState(false)
  
  if (!shareableId) {
    return null
  }
  
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/switch/${shareableId}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  return (
    <button
      onClick={handleCopy}
      className={className || "px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 inline-flex items-center space-x-2"}
    >
      <svg
        className="w-4 h-4"
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
      <span>{copied ? 'Copied!' : 'Share'}</span>
    </button>
  )
}