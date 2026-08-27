import type { ActiveFilters, FilterOptions } from '@/components/CollectionControls'

export type FilterableSwitch = Partial<Record<
  | 'manufacturer' | 'type' | 'technology' | 'topHousing' | 'bottomHousing' | 'stem'
  | 'stemShape' | 'topHousingColor' | 'bottomHousingColor' | 'stemColor' | 'markings'
  | 'springWeight' | 'springLength' | 'magnetOrientation' | 'magnetPosition'
  | 'magnetPolarity' | 'pcbThickness' | 'compatibility', string | null
>> & Partial<Record<
  | 'actuationForce' | 'tactileForce' | 'bottomOutForce' | 'preTravel' | 'bottomOut'
  | 'initialForce' | 'initialMagneticFlux' | 'bottomOutMagneticFlux', number | null
>> & {
  progressiveSpring?: boolean | null
  doubleStage?: boolean | null
  personalTags?: string[] | null
}

const categoricalFields = {
  manufacturer: 'manufacturers', type: 'types', technology: 'technologies',
  topHousing: 'topHousings', bottomHousing: 'bottomHousings', stem: 'stems', stemShape: 'stemShapes',
  topHousingColor: 'topHousingColors', bottomHousingColor: 'bottomHousingColors', stemColor: 'stemColors',
  markings: 'markingsList', springWeight: 'springWeights', springLength: 'springLengths',
  magnetOrientation: 'magnetOrientations', magnetPosition: 'magnetPositions', magnetPolarity: 'magnetPolarities',
  pcbThickness: 'pcbThicknesses', compatibility: 'compatibilities',
} as const

const numericFields = {
  actuationForce: 'actuationForces', tactileForce: 'tactileForces', bottomOutForce: 'bottomOutForces',
  preTravel: 'preTravels', bottomOut: 'bottomOuts', initialForce: 'initialForces',
  initialMagneticFlux: 'initialMagneticFluxes', bottomOutMagneticFlux: 'bottomOutMagneticFluxes',
} as const

export const normalizeFilterValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase() : ''

export function normalizedStringOptions(values: readonly unknown[]): string[] {
  const byNormalized = new Map<string, string>()
  for (const value of values) {
    if (typeof value !== 'string') continue
    const display = value.trim().replace(/\s+/g, ' ')
    const normalized = normalizeFilterValue(display)
    if (normalized && !byNormalized.has(normalized)) byNormalized.set(normalized, display)
  }
  return [...byNormalized.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base', numeric: true }))
}

export function deriveSwitchFilterOptions(records: readonly FilterableSwitch[]): FilterOptions {
  const options = {} as FilterOptions
  for (const [field, option] of Object.entries(categoricalFields) as [keyof typeof categoricalFields, typeof categoricalFields[keyof typeof categoricalFields]][]) {
    options[option] = normalizedStringOptions(records.map(record => record[field]))
  }
  for (const [field, option] of Object.entries(numericFields) as [keyof typeof numericFields, typeof numericFields[keyof typeof numericFields]][]) {
    options[option] = [...new Set(records.map(record => record[field]).filter((value): value is number => typeof value === 'number' && Number.isFinite(value)))].sort((a, b) => a - b)
  }
  options.personalTags = normalizedStringOptions(records.flatMap(record => record.personalTags ?? []))
  options.progressiveSprings = [...new Set(records.map(record => record.progressiveSpring).filter((value): value is boolean => typeof value === 'boolean'))]
  options.doubleStages = [...new Set(records.map(record => record.doubleStage).filter((value): value is boolean => typeof value === 'boolean'))]
  return options
}

export function applySwitchFilters<T extends FilterableSwitch>(records: readonly T[], filters: ActiveFilters): T[] {
  return records.filter(record => {
    for (const field of Object.keys(categoricalFields) as (keyof typeof categoricalFields)[]) {
      const selected = filters[field]
      if (selected && normalizeFilterValue(record[field]) !== normalizeFilterValue(selected)) return false
    }
    if (filters.personalTag && !(record.personalTags ?? []).some(tag => normalizeFilterValue(tag) === normalizeFilterValue(filters.personalTag))) return false
    for (const field of Object.keys(numericFields) as (keyof typeof numericFields)[]) {
      const value = record[field]
      const min = filters[`${field}Min` as keyof ActiveFilters]
      const max = filters[`${field}Max` as keyof ActiveFilters]
      if (typeof min === 'number' && (typeof value !== 'number' || value < min)) return false
      if (typeof max === 'number' && (typeof value !== 'number' || value > max)) return false
    }
    if (filters.progressiveSpring !== undefined && record.progressiveSpring !== filters.progressiveSpring) return false
    if (filters.doubleStage !== undefined && record.doubleStage !== filters.doubleStage) return false
    return true
  })
}
