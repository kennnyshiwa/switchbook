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
export const COLLECTION_QUANTITY_ERROR = `Enter a whole number from 0 to ${QUANTITY_MAX.toLocaleString('en-US')}, or leave blank.`
/** Validates the inline "Qty" field next to Add to Collection. Blank = unknown (null). */
export function validateCollectionQuantity(raw: string): { ok: true; value: number | null } | { ok: false; error: string } {
  const parsed = parseQuantityInput(raw)
  return parsed.ok ? parsed : { ok: false, error: COLLECTION_QUANTITY_ERROR }
}
