'use client'

import { useEffect, useId, useRef, useState } from 'react'

type Props = {
  url?: string
  label?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  buttonLabel?: string
}

export default function ForceCurveLookupButton({
  url = 'https://switchesdb.switchbook.app/',
  label = 'force curves',
  open,
  onOpenChange,
  buttonLabel = 'View exact curve in SwitchesDB',
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const showModal = open ?? uncontrolledOpen
  const triggerRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const wasOpenRef = useRef(false)
  const titleId = useId()

  function setOpen(value: boolean) {
    if (open === undefined) setUncontrolledOpen(value)
    onOpenChange?.(value)
  }

  useEffect(() => {
    if (!showModal) {
      if (wasOpenRef.current) triggerRef.current?.focus()
      wasOpenRef.current = false
      return
    }
    wasOpenRef.current = true
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        setOpen(false)
        window.requestAnimationFrame(() => triggerRef.current?.focus())
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('button, a[href], iframe, [tabindex]:not([tabindex="-1"])')]
        .filter(element => !element.hasAttribute('disabled'))
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    const onFocusIn = (event: FocusEvent) => {
      const dialog = dialogRef.current
      if (dialog && !dialog.contains(event.target as Node)) closeRef.current?.focus()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('focusin', onFocusIn)
    }
  // setOpen intentionally closes over the controlled props for this render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showModal])

  function close() {
    setOpen(false)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus-visible:ring-offset-gray-800"
        title={buttonLabel}
      >
        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
        {buttonLabel}
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-2 sm:p-4" onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby={titleId} className="flex h-[calc(100dvh-1rem)] w-full max-w-7xl flex-col overflow-hidden rounded-lg bg-white shadow-xl sm:h-[90vh] dark:bg-gray-800">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div>
                  <h2 id={titleId} className="break-words text-lg font-semibold text-gray-900 sm:text-xl dark:text-white">
                    SwitchesDB · {label}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Exact read-only measurement preview
                  </p>
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-white"
                  aria-label={`Close SwitchesDB preview for ${label}`}
                >
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 relative">
              <iframe
                src={url}
                className="w-full h-full border-0"
                title={`SwitchesDB exact force curve for ${label}`}
                sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
              />
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
              <div className="text-xs text-gray-600 dark:text-gray-400">
                <strong>Read only:</strong> Viewing or closing this preview does not change the review queue.
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}