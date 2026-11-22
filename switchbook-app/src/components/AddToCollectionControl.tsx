'use client'

import { useId, useState } from 'react'
import { validateCollectionQuantity } from '@/lib/collection-quantity'

/** Result of an add attempt: an error message to show inline, or nothing on success. */
export type AddToCollectionResult = string | null | void

interface AddToCollectionControlProps {
  /** Called with the validated quantity (null = unknown). Return an error message to show it inline. */
  onAdd: (quantity: number | null) => AddToCollectionResult | Promise<AddToCollectionResult>
  isAdding: boolean
  /** Hide the quantity field (e.g. signed-out users who are redirected instead of adding). */
  showQuantity?: boolean
  label?: string
  size?: 'sm' | 'md'
}

/** "Add to Collection" button with an optional inline quantity field; blank = unknown. */
export default function AddToCollectionControl({ onAdd, isAdding, showQuantity = true, label = 'Add to Collection', size = 'sm' }: AddToCollectionControlProps) {
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)
  const errorId = useId()

  const submit = async () => {
    if (isAdding) return
    const parsed = showQuantity ? validateCollectionQuantity(value) : { ok: true as const, value: null }
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    setError(null)
    const result = await onAdd(parsed.value)
    if (typeof result === 'string' && result) setError(result)
    else setValue('')
  }

  const buttonPadding = size === 'md' ? 'px-6 py-2' : 'px-4 py-2 text-sm'

  return (
    <div className="flex flex-col">
      <div className="flex items-stretch gap-2">
        {showQuantity && (
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="Qty"
            aria-label="Quantity to add (optional)"
            title="Quantity (optional) — leave blank if unknown"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : undefined}
            value={value}
            disabled={isAdding}
            onChange={event => { setValue(event.target.value); if (error) setError(null) }}
            onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void submit() } }}
            className={`w-16 sm:w-20 px-2 py-2 text-base sm:text-sm text-center rounded-md border bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 ${error ? 'border-red-500 dark:border-red-500' : 'border-gray-300 dark:border-gray-600'}`}
          />
        )}
        <button
          type="button"
          onClick={() => void submit()}
          disabled={isAdding}
          className={`${buttonPadding} bg-blue-600 text-white text-center rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap`}
        >
          {isAdding ? 'Adding...' : label}
        </button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="mt-1 max-w-xs text-xs text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
