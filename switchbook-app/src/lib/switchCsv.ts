// Shared CSV format for exporting a user's collection and importing it back
// through bulk upload. The export route and the bulk-upload page both use
// these helpers so the two sides can't drift apart.
//
// Format (RFC 4180):
// - Every field is double-quoted; embedded quotes are doubled; commas, CR and
//   LF are kept verbatim inside the quotes. Records end with CRLF.
// - Numbers use JavaScript's shortest round-trip representation.
// - The file starts with a UTF-8 byte order mark so Excel reads unicode
//   correctly; the parser strips it.
// - Booleans are `true` / `false`.
// - Date Obtained is `YYYY-MM-DD` (the UTC date it is stored under).
// - Personal Tags is a JSON array of strings (e.g. `["a","b, c"]`) so tags can
//   contain commas or quotes. On import a value that isn't a JSON array falls
//   back to a comma/semicolon separated list, for hand-written files.

import { QUANTITY_MAX, parseQuantityInput } from './validation'

export type SwitchCsvField =
  | 'name' | 'chineseName' | 'type' | 'technology'
  | 'magnetOrientation' | 'magnetPosition' | 'magnetPolarity'
  | 'initialForce' | 'initialMagneticFlux' | 'bottomOutMagneticFlux'
  | 'pcbThickness' | 'compatibility' | 'manufacturer'
  | 'springWeight' | 'springLength'
  | 'actuationForce' | 'tactileForce' | 'tactilePosition' | 'bottomOutForce'
  | 'progressiveSpring' | 'doubleStage' | 'clickType'
  | 'preTravel' | 'bottomOut'
  | 'topHousing' | 'bottomHousing' | 'stem'
  | 'topHousingColor' | 'bottomHousingColor' | 'stemColor' | 'stemShape' | 'markings'
  | 'frankenTop' | 'frankenBottom' | 'frankenStem'
  | 'notes' | 'personalNotes' | 'personalTags' | 'quantity'
  | 'dateObtained' | 'masterSwitchId' | 'masterSwitchVersion'

type SwitchCsvKind =
  | 'string' | 'name' | 'float' | 'quantity' | 'version' | 'boolean' | 'date' | 'tags' | 'spring'
  | 'type' | 'technology' | 'clickType'
  | 'magnetOrientation' | 'magnetPosition' | 'magnetPolarity'

export interface SwitchCsvColumn {
  key: SwitchCsvField
  /** Header written by the export, and the label shown in the import UI. */
  header: string
  kind: SwitchCsvKind
  required?: boolean
  /** Extra header names accepted on import. */
  aliases?: readonly string[]
  /** Fuzzy header matches must also contain all of these (normalised) words. */
  fuzzyRequires?: readonly string[]
}

export const SWITCH_CSV_COLUMNS: readonly SwitchCsvColumn[] = [
  { key: 'name', header: 'Switch Name', kind: 'name', required: true, aliases: ['Name'] },
  { key: 'chineseName', header: 'Chinese Name', kind: 'string' },
  { key: 'type', header: 'Type', kind: 'type' },
  { key: 'technology', header: 'Technology', kind: 'technology' },
  { key: 'magnetOrientation', header: 'Magnetic Pole Orientation', kind: 'magnetOrientation', aliases: ['Magnet Orientation'] },
  { key: 'magnetPosition', header: 'Magnet Position', kind: 'magnetPosition' },
  { key: 'magnetPolarity', header: 'Magnet Polarity', kind: 'magnetPolarity' },
  { key: 'initialForce', header: 'Initial Force (g)', kind: 'float' },
  { key: 'initialMagneticFlux', header: 'Initial Magnetic Flux (Gs)', kind: 'float' },
  { key: 'bottomOutMagneticFlux', header: 'Bottom Out Magnetic Flux (Gs)', kind: 'float' },
  { key: 'pcbThickness', header: 'PCB Thickness', kind: 'string' },
  { key: 'compatibility', header: 'Compatibility', kind: 'string' },
  { key: 'manufacturer', header: 'Manufacturer', kind: 'string' },
  { key: 'springWeight', header: 'Spring Weight', kind: 'spring' },
  { key: 'springLength', header: 'Spring Length', kind: 'spring' },
  { key: 'actuationForce', header: 'Actuation Force (g)', kind: 'float' },
  { key: 'tactileForce', header: 'Tactile Force (g)', kind: 'float' },
  { key: 'tactilePosition', header: 'Tactile Position (mm)', kind: 'float' },
  { key: 'bottomOutForce', header: 'Bottom Out Force (g)', kind: 'float' },
  { key: 'progressiveSpring', header: 'Progressive Spring', kind: 'boolean' },
  { key: 'doubleStage', header: 'Double Stage', kind: 'boolean' },
  { key: 'clickType', header: 'Click Type', kind: 'clickType' },
  { key: 'preTravel', header: 'Pre-travel (mm)', kind: 'float' },
  { key: 'bottomOut', header: 'Bottom Out (mm)', kind: 'float' },
  { key: 'topHousing', header: 'Top Housing', kind: 'string' },
  { key: 'bottomHousing', header: 'Bottom Housing', kind: 'string' },
  { key: 'stem', header: 'Stem', kind: 'string' },
  { key: 'topHousingColor', header: 'Top Housing Color', kind: 'string' },
  { key: 'bottomHousingColor', header: 'Bottom Housing Color', kind: 'string' },
  { key: 'stemColor', header: 'Stem Color', kind: 'string' },
  { key: 'stemShape', header: 'Stem Shape', kind: 'string' },
  { key: 'markings', header: 'Markings', kind: 'string' },
  { key: 'frankenTop', header: 'Franken Top', kind: 'string' },
  { key: 'frankenBottom', header: 'Franken Bottom', kind: 'string' },
  { key: 'frankenStem', header: 'Franken Stem', kind: 'string' },
  { key: 'notes', header: 'Notes', kind: 'string' },
  { key: 'personalNotes', header: 'Personal Notes', kind: 'string' },
  { key: 'personalTags', header: 'Personal Tags', kind: 'tags', aliases: ['Tags'] },
  { key: 'quantity', header: 'Quantity', kind: 'quantity', aliases: ['Qty'] },
  { key: 'dateObtained', header: 'Date Obtained', kind: 'date' },
  { key: 'masterSwitchId', header: 'Master Switch ID', kind: 'string', aliases: ['Master ID'], fuzzyRequires: ['master', 'id'] },
  { key: 'masterSwitchVersion', header: 'Master Switch Version', kind: 'version', aliases: ['Master Version'], fuzzyRequires: ['master', 'version'] },
]

/**
 * Switch scalar columns deliberately left out of the CSV. Everything else on
 * the Prisma `Switch` model must be in SWITCH_CSV_COLUMNS (enforced by
 * tests/switch-csv-roundtrip.test.ts).
 */
export const SWITCH_CSV_EXCLUDED_FIELDS: Readonly<Record<string, string>> = {
  id: 'internal primary key; import creates new rows',
  userId: 'owner is the importing account',
  createdAt: 'row bookkeeping timestamp, set by the database',
  updatedAt: 'row bookkeeping timestamp, set by the database',
  isModified: 'link bookkeeping; recomputed on import by comparing the row against its master',
  modifiedFields: 'link bookkeeping; recomputed on import by comparing the row against its master',
  shareableId: 'unique share token; copying it would collide or leak a share link',
  primaryImageId: 'points at a SwitchImage row; images are not part of the CSV',
  imageUrl: 'deprecated legacy image field; create/update APIs no longer accept it',
}

export type SwitchCsvData = {
  name?: string
  chineseName?: string
  type?: string
  technology?: string
  magnetOrientation?: string
  magnetPosition?: string
  magnetPolarity?: string
  initialForce?: number
  initialMagneticFlux?: number
  bottomOutMagneticFlux?: number
  pcbThickness?: string
  compatibility?: string
  manufacturer?: string
  springWeight?: string
  springLength?: string
  actuationForce?: number
  tactileForce?: number
  tactilePosition?: number
  bottomOutForce?: number
  progressiveSpring?: boolean
  doubleStage?: boolean
  clickType?: string
  preTravel?: number
  bottomOut?: number
  topHousing?: string
  bottomHousing?: string
  stem?: string
  topHousingColor?: string
  bottomHousingColor?: string
  stemColor?: string
  stemShape?: string
  markings?: string
  frankenTop?: string
  frankenBottom?: string
  frankenStem?: string
  notes?: string
  personalNotes?: string
  personalTags?: string[]
  /** null = the Quantity column was present but blank (clears it). */
  quantity?: number | null
  dateObtained?: string
  masterSwitchId?: string
  masterSwitchVersion?: number
}

/** Any switch-like record (Prisma row or API JSON) that can be exported. */
export type SwitchCsvSource = { [K in SwitchCsvField]?: unknown }

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function escapeCsvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
}

export function encodeCsvTags(tags: readonly string[] | null | undefined): string {
  return tags && tags.length > 0 ? JSON.stringify(tags) : ''
}

function formatDate(value: unknown): string {
  if (value === null || value === undefined || value === '') return ''
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString().slice(0, 10)
}

export function formatSwitchCsvValue(column: SwitchCsvColumn, record: SwitchCsvSource): string {
  const value = record[column.key]
  if (value === null || value === undefined) return ''
  switch (column.kind) {
    case 'boolean':
      return value ? 'true' : 'false'
    case 'date':
      return formatDate(value)
    case 'tags':
      return Array.isArray(value) ? encodeCsvTags(value.map(String)) : ''
    default:
      return String(value)
  }
}

export function switchesToCsv(records: readonly SwitchCsvSource[]): string {
  const lines = [
    SWITCH_CSV_COLUMNS.map(column => escapeCsvCell(column.header)).join(','),
    ...records.map(record =>
      SWITCH_CSV_COLUMNS.map(column => escapeCsvCell(formatSwitchCsvValue(column, record))).join(',')
    ),
  ]
  return '\uFEFF' + lines.join('\r\n') + '\r\n'
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * RFC 4180 parser. Handles quoted fields containing commas, doubled quotes and
 * CR/LF line breaks, plus CRLF/LF/CR record separators and a UTF-8 BOM.
 * Unquoted fields are trimmed (hand-written files often have `a, b`); quoted
 * fields are returned verbatim. Blank lines are skipped.
 */
export function parseCsv(text: string): string[][] {
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  let inQuotes = false
  let i = 0

  const endField = () => {
    row.push(quoted ? field : field.trim())
    field = ''
    quoted = false
  }
  const endRow = () => {
    endField()
    if (!(row.length === 1 && row[0] === '')) rows.push(row)
    row = []
  }

  while (i < input.length) {
    const char = input[i]
    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
      } else {
        field += char
      }
      i++
      continue
    }
    if (char === '"') {
      // Opening quote. Whitespace before it (`a, "b"`) is not part of the value.
      if (field.trim() === '') {
        field = ''
        quoted = true
        inQuotes = true
      } else {
        field += char
      }
    } else if (char === ',') {
      endField()
    } else if (char === '\r' || char === '\n') {
      endRow()
      if (char === '\r' && input[i + 1] === '\n') i++
    } else if (quoted) {
      // Text after a closing quote (`"a" b`) – keep it rather than lose data.
      if (char.trim() !== '') field += char
    } else {
      field += char
    }
    i++
  }
  if (field !== '' || quoted || row.length > 0) endRow()
  return rows
}

const normalizeHeader = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, '')

function exactHeaderMatch(header: string): SwitchCsvField | null {
  const normalized = normalizeHeader(header)
  if (!normalized) return null
  const column = SWITCH_CSV_COLUMNS.find(candidate =>
    [candidate.header, candidate.key, ...(candidate.aliases ?? [])].some(name => normalizeHeader(name) === normalized)
  )
  return column ? column.key : null
}

// Legacy fuzzy match kept from the original importer, made specific-first: a
// header containing a field key ("Personal Notes (private)") goes to the
// longest key it contains, so personalNotes wins over notes.
function partialHeaderMatch(header: string): SwitchCsvField | null {
  const normalized = normalizeHeader(header)
  if (!normalized) return null
  const eligible = SWITCH_CSV_COLUMNS.filter(column => (column.fuzzyRequires ?? []).every(word => normalized.includes(word)))
  const byKey = eligible
    .filter(column => column.key.length > 3 && normalized.includes(column.key.toLowerCase()))
    .sort((a, b) => b.key.length - a.key.length)[0]
  if (byKey) return byKey.key
  const byLabel = normalized.length > 3
    ? eligible.find(column => normalizeHeader(column.header).includes(normalized))
    : undefined
  return byLabel ? byLabel.key : null
}

/** Map a CSV header to a switch field, or null if it isn't recognised. */
export function matchSwitchCsvHeader(header: string): SwitchCsvField | null {
  return exactHeaderMatch(header) ?? partialHeaderMatch(header)
}

/**
 * Column index (as string) -> field, in the shape the bulk-upload page uses.
 * Exact header matches are assigned first so a fuzzy match on another column
 * can never take a field away from its real column.
 */
export function mapSwitchCsvHeaders(headers: readonly string[]): Record<string, SwitchCsvField | null> {
  const mapping: Record<string, SwitchCsvField | null> = {}
  const used = new Set<SwitchCsvField>()
  for (const matcher of [exactHeaderMatch, partialHeaderMatch]) {
    headers.forEach((header, index) => {
      if (mapping[index.toString()]) return
      const key = matcher(header)
      if (key && !used.has(key)) {
        mapping[index.toString()] = key
        used.add(key)
      }
    })
  }
  return mapping
}

export function decodeCsvTags(value: string): string[] {
  const trimmed = value.trim()
  if (!trimmed) return []
  if (trimmed.startsWith('[')) {
    try {
      const parsed: unknown = JSON.parse(trimmed)
      if (Array.isArray(parsed) && parsed.every(tag => typeof tag === 'string')) return parsed
    } catch {
      // Not JSON – fall through to the delimited form.
    }
  }
  return trimmed.split(/[;,]/).map(tag => tag.trim()).filter(Boolean)
}

/**
 * Keep "45 G" style values tidy ("45g") but never truncate anything more
 * descriptive, e.g. "62g / 68g progressive".
 */
export function cleanSpringValue(value: string): string {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)$/)
  return match ? `${match[1]}${match[2].toLowerCase()}` : value
}

const TYPE_ALIASES: Record<string, string> = {
  LINEAR: 'LINEAR', TACTILE: 'TACTILE', CLICKY: 'CLICKY', SILENT_LINEAR: 'SILENT_LINEAR',
  SILENT_TACTILE: 'SILENT_TACTILE', MOUSE: 'MOUSE', SILENTLINEAR: 'SILENT_LINEAR', SILENTTACTILE: 'SILENT_TACTILE',
}
const TECHNOLOGY_ALIASES: Record<string, string> = {
  MECHANICAL: 'MECHANICAL', OPTICAL: 'OPTICAL', MAGNETIC: 'MAGNETIC', INDUCTIVE: 'INDUCTIVE',
  ELECTRO_CAPACITIVE: 'ELECTRO_CAPACITIVE', ELECTROCAPACITIVE: 'ELECTRO_CAPACITIVE',
  HALL_EFFECT: 'MAGNETIC', HALLEFFECT: 'MAGNETIC',
}
const CLICK_TYPE_ALIASES: Record<string, string> = {
  CLICK_LEAF: 'CLICK_LEAF', CLICKLEAF: 'CLICK_LEAF', LEAF: 'CLICK_LEAF',
  CLICK_BAR: 'CLICK_BAR', CLICKBAR: 'CLICK_BAR', BAR: 'CLICK_BAR',
  CLICK_JACKET: 'CLICK_JACKET', CLICKJACKET: 'CLICK_JACKET', JACKET: 'CLICK_JACKET',
}

function normalizeChoice(value: string, choices: Record<string, string[]>): string {
  const trimmed = value.trim()
  const lower = trimmed.toLowerCase()
  for (const [canonical, aliases] of Object.entries(choices)) {
    if (aliases.includes(lower)) return canonical
  }
  return trimmed
}

export const QUANTITY_ERROR = `Quantity must be a whole number from 0 to ${QUANTITY_MAX.toLocaleString('en-US')}`

type ParsedCell =
  | { ok: true; value: SwitchCsvData[SwitchCsvField] | undefined }
  | { ok: false; error: string }

/**
 * Convert one raw CSV cell to the value the switch API expects.
 * - Blank cells are `undefined` (field not set), except the user-only fields
 *   Quantity (null), Personal Notes ('') and Personal Tags ([]): a blank cell
 *   in a mapped column for those clears the stored value on overwrite.
 * - Unparsable floats are dropped (legacy behaviour); an invalid Quantity is
 *   reported as an error so the row can be fixed instead of silently losing it.
 * - Name, enum, number and date cells are trimmed; free-text cells (notes,
 *   materials, ...) are kept verbatim.
 */
function parseCell(key: SwitchCsvField, raw: string): ParsedCell {
  const column = SWITCH_CSV_COLUMNS.find(candidate => candidate.key === key)
  if (!column) return { ok: true, value: undefined }
  const trimmed = raw.trim()
  if (trimmed === '') {
    if (key === 'quantity') return { ok: true, value: null }
    if (key === 'personalNotes') return { ok: true, value: '' }
    if (key === 'personalTags') return { ok: true, value: [] }
    return { ok: true, value: undefined }
  }
  switch (column.kind) {
    case 'name':
      return { ok: true, value: trimmed }
    case 'float': {
      const number = parseFloat(trimmed)
      return { ok: true, value: Number.isNaN(number) ? undefined : number }
    }
    case 'quantity': {
      const parsed = parseQuantityInput(trimmed)
      return parsed.ok ? { ok: true, value: parsed.value } : { ok: false, error: `${QUANTITY_ERROR} (got "${trimmed}")` }
    }
    case 'version': {
      const number = Number(trimmed)
      return { ok: true, value: Number.isInteger(number) && number >= 1 ? number : undefined }
    }
    case 'boolean':
      return { ok: true, value: ['true', 'yes', '1', 'y'].includes(trimmed.toLowerCase()) }
    case 'tags':
      return { ok: true, value: decodeCsvTags(raw) }
    case 'date':
      return { ok: true, value: trimmed }
    case 'spring':
      return { ok: true, value: cleanSpringValue(raw) }
    case 'type': {
      const normalized = trimmed.toUpperCase().replace(/[\s_-]/g, '_')
      return { ok: true, value: TYPE_ALIASES[normalized] || normalized }
    }
    case 'technology': {
      const normalized = trimmed.toUpperCase().replace(/[\s_-]/g, '_')
      return { ok: true, value: TECHNOLOGY_ALIASES[normalized] || normalized }
    }
    case 'clickType': {
      const normalized = trimmed.toUpperCase().replace(/[\s-]/g, '_')
      return { ok: true, value: CLICK_TYPE_ALIASES[normalized] || normalized }
    }
    case 'magnetOrientation':
      return { ok: true, value: normalizeChoice(raw, { Horizontal: ['horizontal', 'h'], Vertical: ['vertical', 'v'] }) }
    case 'magnetPosition':
      return { ok: true, value: normalizeChoice(raw, { Center: ['center', 'c'], 'Off-Center': ['off-center', 'offcenter', 'off center', 'oc'] }) }
    case 'magnetPolarity':
      return { ok: true, value: normalizeChoice(raw, { North: ['north', 'n'], South: ['south', 's'] }) }
    default:
      return { ok: true, value: raw }
  }
}

/** Value for one cell, or undefined when blank/unparsable. */
export function parseSwitchCsvValue(key: SwitchCsvField, raw: string): SwitchCsvData[SwitchCsvField] | undefined {
  const parsed = parseCell(key, raw)
  return parsed.ok ? parsed.value : undefined
}

export interface ParsedSwitchCsvRow {
  data: SwitchCsvData
  /** Per-field problems to show in the import preview. */
  errors: Partial<Record<SwitchCsvField, string>>
}

/** Build switch data (plus per-field errors) from one CSV record. */
export function parseSwitchCsvRow(
  row: readonly string[],
  mapping: Readonly<Record<string, SwitchCsvField | null | undefined>>
): ParsedSwitchCsvRow {
  const data: Record<string, unknown> = {}
  const errors: Partial<Record<SwitchCsvField, string>> = {}
  for (const [index, key] of Object.entries(mapping)) {
    // A short row (fewer cells than headers) leaves trailing fields absent –
    // unchanged on overwrite. Only an explicitly present empty cell clears.
    if (!key || Number(index) >= row.length) continue
    const parsed = parseCell(key, row[Number(index)])
    if (!parsed.ok) errors[key] = parsed.error
    else if (parsed.value !== undefined) data[key] = parsed.value
  }
  return { data: data as SwitchCsvData, errors }
}

/** Build switch data from one CSV record using a column mapping. */
export function csvRowToSwitchData(
  row: readonly string[],
  mapping: Readonly<Record<string, SwitchCsvField | null | undefined>>
): SwitchCsvData {
  return parseSwitchCsvRow(row, mapping).data
}
