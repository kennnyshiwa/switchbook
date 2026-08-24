export type ShareSourceKind = 'master' | 'user'

export interface CanonicalShareImage {
  id?: string
  url: string
  alt?: string | null
}

export interface CanonicalShareStat {
  key: string
  label: string
  value: string
}

export interface CanonicalShareSection {
  title: string
  stats: CanonicalShareStat[]
}

export interface CanonicalSwitchShare {
  sourceKind: ShareSourceKind
  name: string
  chineseName?: string
  manufacturer?: string
  type?: string
  technology?: string
  attribution?: string
  images: CanonicalShareImage[]
  sections: CanonicalShareSection[]
  notes?: string
  personalSections: CanonicalShareSection[]
  personalNotes?: string
  isFranken: boolean
}

type ShareRecord = Record<string, unknown> & {
  images?: Array<Record<string, unknown>>
  user?: Record<string, unknown>
  submittedBy?: Record<string, unknown>
}

type StatDefinition = [key: string, label: string, unit?: string]

const SECTIONS: Array<[title: string, definitions: StatDefinition[]]> = [
  ['Identity', [
    ['compatibility', 'Compatibility'], ['clickType', 'Click Type'],
  ]],
  ['Materials & Construction', [
    ['topHousing', 'Top Housing'], ['bottomHousing', 'Bottom Housing'], ['stem', 'Stem'],
    ['topHousingColor', 'Top Housing Color'], ['bottomHousingColor', 'Bottom Housing Color'],
    ['stemColor', 'Stem Color'], ['stemShape', 'Stem Shape'], ['markings', 'Markings'],
  ]],
  ['Spring', [
    ['springWeight', 'Spring Weight', 'g'], ['springLength', 'Spring Length', 'mm'],
    ['doubleStage', 'Double-stage Spring'], ['progressiveSpring', 'Progressive Spring'],
  ]],
  ['Force', [
    ['initialForce', 'Initial Force', 'g'], ['actuationForce', 'Actuation Force', 'g'],
    ['tactileForce', 'Tactile Force', 'g'], ['bottomOutForce', 'Bottom-out Force', 'g'],
  ]],
  ['Travel', [
    ['preTravel', 'Pre-travel', 'mm'], ['tactilePosition', 'Tactile Position', 'mm'],
    ['bottomOut', 'Total Travel', 'mm'],
  ]],
  ['Magnetic', [
    ['magnetOrientation', 'Magnet Orientation'], ['magnetPosition', 'Magnet Position'],
    ['magnetPolarity', 'Magnet Polarity'], ['pcbThickness', 'PCB Thickness'],
    ['initialMagneticFlux', 'Initial Magnetic Flux', 'mT'],
    ['bottomOutMagneticFlux', 'Bottom-out Magnetic Flux', 'mT'],
  ]],
  ['Franken Parts', [
    ['frankenTop', 'Top Housing'], ['frankenBottom', 'Bottom Housing'], ['frankenStem', 'Stem'],
  ]],
]

function present(value: unknown): boolean {
  return value !== null && value !== undefined && value !== ''
}

function display(value: unknown, unit?: string): string {
  if (value === true) return 'Yes'
  if (value === false) return 'No'
  const text = String(value)
  if (!unit || text.toLowerCase().endsWith(unit.toLowerCase())) return text
  return `${text}${unit}`
}

function serializeSections(record: ShareRecord): CanonicalShareSection[] {
  return SECTIONS.map(([title, definitions]) => ({
    title,
    stats: definitions
      .filter(([key]) => present(record[key]))
      .map(([key, label, unit]) => ({ key, label, value: display(record[key], unit) })),
  })).filter(section => section.stats.length > 0)
}

function serializeImages(record: ShareRecord): CanonicalShareImage[] {
  const relationImages: CanonicalShareImage[] = (record.images || [])
    .filter(image => typeof image.url === 'string' && image.url.length > 0)
    .map(image => ({ id: image.id as string | undefined, url: image.url as string, alt: image.altText as string | null | undefined }))
  const primaryId = record.primaryImageId
  relationImages.sort((a, b) => (a.id === primaryId ? -1 : b.id === primaryId ? 1 : 0))
  if (typeof record.imageUrl === 'string' && record.imageUrl && !relationImages.some(image => image.url === record.imageUrl)) {
    relationImages.push({ url: record.imageUrl })
  }
  return relationImages
}

export function serializeCanonicalSwitchShare(sourceKind: ShareSourceKind, record: ShareRecord): CanonicalSwitchShare {
  const username = sourceKind === 'master' ? record.submittedBy?.username : record.user?.username
  const personalStats: CanonicalShareStat[] = sourceKind === 'user'
    ? [
        ['dateObtained', 'Date Obtained', record.dateObtained ? new Date(String(record.dateObtained)).toLocaleDateString('en-US', { timeZone: 'UTC' }) : null],
        ['personalTags', 'Personal Tags', Array.isArray(record.personalTags) && record.personalTags.length ? record.personalTags.join(', ') : null],
        ['isModified', 'Modified', Object.prototype.hasOwnProperty.call(record, 'isModified') && typeof record.isModified === 'boolean' ? display(record.isModified) : null],
      ].filter((entry): entry is [string, string, string] => Boolean(entry[2])).map(([key, label, value]) => ({ key, label, value }))
    : []

  return {
    sourceKind,
    name: String(record.name || record.chineseName || 'Unknown Switch'),
    chineseName: present(record.chineseName) ? String(record.chineseName) : undefined,
    manufacturer: present(record.manufacturer) ? String(record.manufacturer) : undefined,
    type: present(record.type) ? String(record.type) : undefined,
    technology: present(record.technology) ? String(record.technology) : undefined,
    attribution: typeof username === 'string'
      ? (sourceKind === 'master' ? `Submitted by ${username}` : `From ${username}'s collection`)
      : undefined,
    images: serializeImages(record),
    sections: serializeSections(record),
    notes: present(record.notes) ? String(record.notes) : undefined,
    personalSections: personalStats.length ? [{ title: 'Collection Details', stats: personalStats }] : [],
    personalNotes: sourceKind === 'user' && present(record.personalNotes) ? String(record.personalNotes) : undefined,
    isFranken: Boolean(record.frankenTop || record.frankenBottom || record.frankenStem),
  }
}
