/**
 * Formats a value with a unit, ensuring no duplicate units
 * @param value - The value that may or may not already contain a unit
 * @param unit - The unit to append if not already present
 * @returns The formatted value with a single unit
 */
export function formatWithUnit(value: string | number | null | undefined, unit: string): string {
  if (!value && value !== 0) return '-'
  
  const stringValue = value.toString().trim()
  
  // Check if the value already ends with the unit
  if (stringValue.endsWith(unit)) {
    return stringValue
  }
  
  // Check if the value ends with any common unit variation
  const unitVariations = {
    'g': ['g', 'G', 'grams', 'gram'],
    'mm': ['mm', 'MM', 'millimeters', 'millimeter'],
  }
  
  const variations = unitVariations[unit as keyof typeof unitVariations] || [unit]
  
  for (const variation of variations) {
    if (stringValue.toLowerCase().endsWith(variation.toLowerCase())) {
      // Replace the existing unit with the standard one
      const numericPart = stringValue.slice(0, -variation.length).trim()
      return `${numericPart}${unit}`
    }
  }
  
  // If no unit found, append it
  return `${stringValue}${unit}`
}