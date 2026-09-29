'use client'

import { useState } from 'react'

interface PrintLabelButtonProps {
  switchId: string
  variant?: 'button' | 'badge'
  className?: string
}

export default function PrintLabelButton({
  switchId,
  variant = 'button',
  className = '',
}: PrintLabelButtonProps) {
  const [blocked, setBlocked] = useState(false)

  // The label is its own document so the 4x6 @page rules survive; the route
  // triggers print itself once loaded.
  const openLabel = () => {
    const win = window.open(
      `/api/switches/${switchId}/label`,
      '_blank',
      'noopener,noreferrer,width=520,height=760'
    )
    setBlocked(!win)
  }

  const label = 'Print Label'

  if (variant === 'badge') {
    return (
      <button
        type="button"
        onClick={openLabel}
        title="Print a 4x6 label for this switch"
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-200 cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors ${className}`}
      >
        {label}
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={openLabel}
        title="Print a 4x6 label for this switch"
        className={`inline-flex items-center px-3 py-1.5 text-sm font-medium text-slate-700 bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:border-slate-600 dark:hover:bg-slate-600 transition-colors ${className}`}
      >
        {label}
      </button>
      {blocked && (
        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
          Allow pop-ups for this site to print labels.
        </p>
      )}
    </>
  )
}
