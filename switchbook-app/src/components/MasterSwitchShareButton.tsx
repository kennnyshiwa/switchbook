'use client'

import React, { useState } from 'react'
import { SHARE_ERROR_ICON_PATH, SHARE_ICON_PATH, SHARE_SUCCESS_ICON_PATH } from './SwitchShareButton'

interface MasterSwitchShareButtonProps {
  shareableId: string | null | undefined
  className?: string
}

export function getMasterSwitchShareUrl(shareableId: string, origin: string) {
  return `${origin}/share/switch/${shareableId}`
}

export default function MasterSwitchShareButton({ shareableId, className }: MasterSwitchShareButtonProps) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')
  
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
      setStatus('copied')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const accessibleText = status === 'copied'
    ? 'Share link copied'
    : status === 'error'
      ? 'Failed to copy share link'
      : 'Copy share link'

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-label={accessibleText}
      title={accessibleText}
      data-share-state={status}
      className={className || "text-indigo-600 hover:text-indigo-800"}
    >
      <svg
        aria-hidden="true"
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={
          status === 'copied' ? SHARE_SUCCESS_ICON_PATH : status === 'error' ? SHARE_ERROR_ICON_PATH : SHARE_ICON_PATH
        } />
      </svg>
    </button>
  )
}
