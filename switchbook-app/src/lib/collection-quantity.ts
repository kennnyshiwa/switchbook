import { parseQuantityInput, QUANTITY_MAX } from './validation'
type QuantityRow = { quantity?: number | null }
/** Unknown always sorts last, in either direction. Equal quantities stay stable. */
export function compareQuantity(a: QuantityRow, b: QuantityRow, direction: 'asc' | 'desc'): number {
  if (a.quantity == null) return b.quantity == null ? 0 : 1
  if (b.quantity == null) return -1
  return direction === 'asc' ? a.quantity - b.quantity : b.quantity - a.quantity
}
export function summarizeQuantity(rows: readonly QuantityRow[]) {
  return { knownUnits: rows.reduce((sum, row) => sum + (row.quantity ?? 0), 0), unknownEntries: rows.filter(row => row.quantity == null).length }
}
/** Native confirmation matches catalog's existing alert flows; cancel does not add. */
export function requestCollectionQuantity(promptValue: (message: string) => string | null, showError: (message: string) => void): number | null | undefined {
  const value = promptValue('Quantity to add (optional). Leave blank if unknown; Cancel to stop.')
  if (value === null) return undefined
  const parsed = parseQuantityInput(value)
  if (parsed.ok) return parsed.value
  showError(`Quantity must be a whole number from 0 to ${QUANTITY_MAX.toLocaleString('en-US')}. Nothing was added.`)
  return undefined
}
