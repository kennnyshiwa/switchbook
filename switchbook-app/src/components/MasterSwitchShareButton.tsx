'use client'

import React, { useState } from 'react'

interface MasterSwitchShareButtonProps {
  shareableId: string | null | undefined
  className?: string
}

export function getMasterSwitchShareUrl(shareableId: string, origin: string) {
  return `${origin}/share/switch/${shareableId}`
}

export default function MasterSwitchShareButton({ shareableId, className }: MasterSwitchShareButtonProps) {
  const [copied, setCopied] = useState(false)
  
  if (!shareableId) {
    return null
  }
  
  const shareUrl = getMasterSwitchShareUrl(
    shareableId,
    typeof window !== 'undefined' ? window.location.origin : ''
  )

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      // Failed to copy to clipboard
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={copied ? 'Share link copied' : 'Copy share link'}
      className={className || "px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 inline-flex items-center space-x-2"}
    >
      <svg
        aria-hidden="true"
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
      <span>{copied ? 'Copied!' : 'Copy Share Link'}</span>
    </button>
  )
}
