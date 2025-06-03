'use client'

import { useState } from 'react'

interface ShareButtonProps {
  shareableId: string
}

export default function ShareButton({ shareableId }: ShareButtonProps) {
  const [copied, setCopied] = useState(false)
  
  const shareUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/share/${shareableId}`

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
      className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
    >
      <svg
        className="w-4 h-4 mr-2"
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
      {copied ? 'Copied!' : 'Share Collection'}
    </button>
  )
}