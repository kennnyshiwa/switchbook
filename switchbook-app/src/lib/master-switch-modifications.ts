// Which fields of a linked user switch differ from its master switch. Used by
// the edit route (PUT /api/switches/[id]) and by re-linking imports on create
// (POST /api/switches) so both mark `isModified` / `modifiedFields` the same way.

export const MASTER_TRACKED_FIELDS = [
  'name', 'chineseName', 'type', 'technology', 'manufacturer',
  'actuationForce', 'bottomOutForce', 'preTravel', 'bottomOut',
  'springWeight', 'springLength', 'notes',
  'topHousing', 'bottomHousing', 'stem',
  'topHousingColor', 'bottomHousingColor', 'stemColor', 'stemShape', 'markings',
  'magnetOrientation', 'magnetPosition', 'magnetPolarity',
  'initialForce', 'initialMagneticFlux', 'bottomOutMagneticFlux',
  'pcbThickness', 'compatibility', 'tactileForce',
  'progressiveSpring', 'doubleStage', 'clickType', 'tactilePosition', 'frankenTop', 'frankenBottom', 'frankenStem',
] as const

export type MasterTrackedField = typeof MASTER_TRACKED_FIELDS[number]

/** Prisma `select` fragment loading every tracked field from a MasterSwitch. */
export const MASTER_TRACKED_SELECT = Object.fromEntries(
  MASTER_TRACKED_FIELDS.map(field => [field, true])
) as Record<MasterTrackedField, true>

// Treat null / undefined / empty string as the same "no value".
const normalize = (value: unknown) => (value === null || value === undefined || value === '' ? null : value)

export function computeMasterModifiedFields(
  switchData: Record<string, unknown>,
  master: Record<string, unknown>
): string[] {
  return MASTER_TRACKED_FIELDS.filter(field => normalize(switchData[field]) !== normalize(master[field]))
}

/** One exhaustive scalar copy contract; excludes inventory, personal data and images. */
export function copyMasterFields<T extends Record<MasterTrackedField, unknown>>(master: T): Pick<T, MasterTrackedField> {
  return Object.fromEntries(MASTER_TRACKED_FIELDS.map(field => [field, master[field]])) as Pick<T, MasterTrackedField>
}
