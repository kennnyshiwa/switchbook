/**
 * Renders a 4in x 6in printable switch label as a standalone HTML document.
 *
 * The document is deliberately self-contained: the @page sizing and the
 * print-color-adjust rules that keep the type markers solid on a label
 * printer cannot survive being rendered inside the app shell, so this is
 * served as its own document rather than as a React page.
 *
 * The spec grid carries measurements only. Colours, markings and images are
 * on the switch itself, so printing them wastes the space that stats need.
 */

export type LabelSwitchType =
  | 'LINEAR'
  | 'TACTILE'
  | 'CLICKY'
  | 'SILENT_LINEAR'
  | 'SILENT_TACTILE'
  | 'MOUSE'

export type LabelTechnology =
  | 'MECHANICAL'
  | 'OPTICAL'
  | 'MAGNETIC'
  | 'INDUCTIVE'
  | 'ELECTRO_CAPACITIVE'

export type LabelClickType = 'CLICK_LEAF' | 'CLICK_BAR' | 'CLICK_JACKET'

export interface LabelSwitchInput {
  name: string
  type?: LabelSwitchType | null
  technology?: LabelTechnology | null
  manufacturer?: string | null

  actuationForce?: number | null
  bottomOutForce?: number | null
  initialForce?: number | null
  tactileForce?: number | null
  tactilePosition?: number | null
  preTravel?: number | null
  bottomOut?: number | null

  springWeight?: string | null
  springLength?: string | null
  progressiveSpring?: boolean | null
  doubleStage?: boolean | null

  stem?: string | null
  stemShape?: string | null
  topHousing?: string | null
  bottomHousing?: string | null
  compatibility?: string | null
  clickType?: LabelClickType | null

  initialMagneticFlux?: number | null
  bottomOutMagneticFlux?: number | null
  magnetPolarity?: string | null
  magnetOrientation?: string | null
  magnetPosition?: string | null
  pcbThickness?: string | null

  isModified?: boolean | null
  frankenTop?: string | null
  frankenStem?: string | null
  frankenBottom?: string | null

  notes?: string | null
  personalNotes?: string | null
}

const EM_DASH = '&#8212;'

/** Left-edge pattern that encodes the switch type. Mouse has no pattern. */
const MARKER_CLASS: Record<LabelSwitchType, string> = {
  LINEAR: 'linear',
  TACTILE: 'tactile',
  CLICKY: 'clicky',
  SILENT_LINEAR: 'silent',
  SILENT_TACTILE: 'silent',
  MOUSE: '',
}

const TYPE_LABEL: Record<LabelSwitchType, string> = {
  LINEAR: 'Linear',
  TACTILE: 'Tactile',
  CLICKY: 'Clicky',
  SILENT_LINEAR: 'Silent Linear',
  SILENT_TACTILE: 'Silent Tactile',
  MOUSE: 'Mouse',
}

const TYPE_DESC: Record<LabelSwitchType, string> = {
  LINEAR: 'Smooth travel, no bump',
  TACTILE: 'Tactile bump, no click',
  CLICKY: 'Tactile bump with click',
  SILENT_LINEAR: 'Smooth travel, dampened',
  SILENT_TACTILE: 'Tactile bump, dampened',
  MOUSE: 'Mouse switch',
}

const TECHNOLOGY_LABEL: Record<LabelTechnology, string> = {
  MECHANICAL: 'Mechanical',
  OPTICAL: 'Optical',
  MAGNETIC: 'Magnetic',
  INDUCTIVE: 'Inductive',
  ELECTRO_CAPACITIVE: 'Electro-Capacitive',
}

const CLICK_TYPE_LABEL: Record<LabelClickType, string> = {
  CLICK_LEAF: 'Click Leaf',
  CLICK_BAR: 'Click Bar',
  CLICK_JACKET: 'Click Jacket',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function text(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? escapeHtml(trimmed) : null
}

/** Numbers render as whole units when whole, e.g. 65 g not 65.0 g. */
function measure(value: number | null | undefined, unit: string): string | null {
  if (value === null || value === undefined || !Number.isFinite(value)) return null
  const rounded = Math.round(value * 100) / 100
  return `${Number.isInteger(rounded) ? rounded : rounded} ${unit}`
}

/**
 * The template letter-spaces the manufacturer for the look of a wide caps
 * line. At two or three characters that reads as "W S" rather than "WS",
 * so short names lose the tracking.
 */
function manufacturerStyle(manufacturer: string): string {
  return manufacturer.replace(/\s/g, '').length <= 3
    ? ' style="letter-spacing:0.3pt"'
    : ''
}

export function renderSwitchLabel(item: LabelSwitchInput): string {
  const type = item.type ?? null
  const markerClass = type ? MARKER_CLASS[type] : ''
  const typeLabel = type ? TYPE_LABEL[type] : ''
  const typeDesc = type ? TYPE_DESC[type] : ''

  // actuationForce is the measured value; springWeight is the free-text spec
  // people record when they never measured one.
  const actuation = measure(item.actuationForce, 'g') ?? text(item.springWeight)
  const springWeight = text(item.springWeight)

  const specs: [string, string | null][] = [
    ['Actuation', actuation],
    ['Bottom Out', measure(item.bottomOutForce, 'g')],
    ['Initial Force', measure(item.initialForce, 'g')],
    ['Tactile Force', measure(item.tactileForce, 'g')],
    ['Tactile Pos', measure(item.tactilePosition, 'mm')],
    ['Pre-Travel', measure(item.preTravel, 'mm')],
    ['Total Travel', measure(item.bottomOut, 'mm')],
    // Only worth a cell when it is not already standing in for actuation.
    ['Spring', springWeight && springWeight !== actuation ? springWeight : null],
    ['Spring Length', text(item.springLength)],
    ['Technology', item.technology ? TECHNOLOGY_LABEL[item.technology] : null],
    ['Click Type', item.clickType ? CLICK_TYPE_LABEL[item.clickType] : null],
    ['Stem', text(item.stem)],
    ['Stem Shape', text(item.stemShape)],
    ['Top Housing', text(item.topHousing)],
    ['Bottom Housing', text(item.bottomHousing)],
    ['Compatibility', text(item.compatibility)],
    ['Initial Flux', measure(item.initialMagneticFlux, 'Gs')],
    ['Bottom Out Flux', measure(item.bottomOutMagneticFlux, 'Gs')],
    ['Magnet Polarity', text(item.magnetPolarity)],
    ['Magnet Orientation', text(item.magnetOrientation)],
    ['Magnet Position', text(item.magnetPosition)],
    ['PCB Thickness', text(item.pcbThickness)],
    ['Franken Top', text(item.frankenTop)],
    ['Franken Stem', text(item.frankenStem)],
    ['Franken Bottom', text(item.frankenBottom)],
  ]

  const present = specs.filter((entry): entry is [string, string] => Boolean(entry[1]))

  // A blank label is worse than a sparse one: if nothing is recorded, keep the
  // four headline cells so the card still reads as a spec card.
  const cells = present.length
    ? present
    : ([
        ['Actuation', EM_DASH],
        ['Bottom Out', EM_DASH],
        ['Stem', EM_DASH],
        ['Compatibility', EM_DASH],
      ] as [string, string][])

  // The card is a fixed box on a fixed sheet, so a fully-specified switch has
  // to be fitted rather than allowed to overflow: past twelve measurements the
  // grid gains a fourth column, and the type scales down with it.
  const columns = cells.length > 12 ? 4 : 3
  const valueSize = cells.length <= 9 ? 12 : cells.length <= 15 ? 9.5 : 8
  const labelSize = cells.length <= 15 ? 5.5 : 5
  const rowGap = cells.length <= 9 ? 5 : 3

  const flags = [
    item.doubleStage ? 'Double stage' : null,
    item.progressiveSpring ? 'Progressive spring' : null,
    item.isModified ? 'Modified' : null,
  ].filter(Boolean) as string[]

  const notes = item.personalNotes?.trim() || item.notes?.trim() || ''
  const manufacturer = item.manufacturer?.trim() || ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${text(item.name) ?? 'Switch'}</title>
<style>
@page { size: 4in 6in; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { width: 4in; height: 6in; background: white; }
body { font-family: 'Arial', sans-serif; }

/* Content in top 3.25in; bottom 2.75in blank.
   Left margin 0.18in compensates for printer clipping. */
.sheet {
  width: 4in;
  height: 3.25in;
  position: relative;
  overflow: hidden;
  background: white;
}

/* tag: 2in wide x 0.5in tall, starts at left margin */
.tag {
  position: absolute;
  top: 0;
  left: 0.18in;
  width: 2in;
  height: 0.5in;
  display: flex;
  align-items: center;
  border: 1pt solid black;
  overflow: hidden;
}

/* left edge pattern encodes switch type - force printing of backgrounds */
.t-marker {
  width: 8pt;
  height: 100%;
  flex-shrink: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.t-marker.tactile {
  background-image: repeating-linear-gradient(45deg, black 0, black 1pt, white 1pt, white 3pt);
}
.t-marker.clicky  { background: black; }
.t-marker.linear  {
  background-image: repeating-linear-gradient(0deg, black 0, black 1.5pt, white 1.5pt, white 4pt);
}
.t-marker.silent  {
  background-image: radial-gradient(circle, black 1pt, transparent 1pt);
  background-size: 3pt 3pt;
}

/* name: shrinks to give badge room, ellipsis if too long */
.t-name {
  flex: 1;
  min-width: 0;
  padding: 0 5pt;
  font-size: 8pt;
  font-weight: 800;
  color: #000;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* type badge: always visible, black bg white text */
.t-type {
  flex-shrink: 0;
  font-size: 6pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.8pt;
  background: black;
  color: white;
  padding: 2.5pt 4.5pt;
  margin-right: 5pt;
  white-space: nowrap;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

/* cut lines */
/* vertical: right edge of the 2in tag - cut tag to length */
.cut-v {
  position: absolute;
  top: 0;
  left: calc(0.18in + 2in);
  width: 0;
  height: 0.5in;
  border-left: 0.75pt dashed #aaa;
}
.cut-v-label {
  position: absolute;
  top: 2pt;
  left: calc(0.18in + 2in + 2pt);
  font-size: 5pt;
  color: #bbb;
}

/* horizontal: below tag strip - cut tag from card */
.cut-h {
  position: absolute;
  top: 0.5in;
  left: 0.18in;
  right: 0;
  border-top: 0.75pt dashed #aaa;
}
.cut-h-label {
  position: absolute;
  top: 0.5in;
  right: 4pt;
  font-size: 5pt;
  color: #bbb;
  transform: translateY(-8pt);
}

/* reference card */
.card {
  position: absolute;
  top: 0.54in;
  left: 0.18in;
  right: 3pt;
  bottom: 3pt;
  border: 1.5pt solid black;
  display: flex;
  flex-direction: column;
}

.c-head {
  border-bottom: 1.5pt solid black;
  padding: 0.09in 0.13in 0.07in;
}
.c-name {
  font-size: 19pt;
  font-weight: 900;
  color: #000;
  line-height: 0.94;
  letter-spacing: -0.3pt;
}
.c-mfr {
  font-size: 7pt;
  color: #333;
  text-transform: uppercase;
  letter-spacing: 1.5pt;
  margin-top: 3pt;
}

/* type badge inside card: black bg white text */
.c-type-box {
  font-size: 7.5pt;
  font-weight: 700;
  letter-spacing: 1.5pt;
  text-transform: uppercase;
  background: black;
  color: white;
  padding: 2pt 7pt;
  flex-shrink: 0;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.c-type-row {
  padding: 4pt 11pt;
  border-bottom: 0.5pt solid #ccc;
  display: flex;
  gap: 7pt;
  align-items: center;
}
.c-type-desc {
  font-size: 6.5pt;
  color: #555;
  font-style: italic;
}

/* spec grid: column count and type scale with how much is recorded */
.c-specs-grid {
  padding: 5pt 10pt;
  display: grid;
  grid-template-columns: repeat(${columns}, 1fr);
  gap: ${rowGap}pt 7pt;
  flex: 1;
  align-content: start;
}
.s-label {
  font-size: ${labelSize}pt;
  text-transform: uppercase;
  letter-spacing: 0.6pt;
  color: #888;
  margin-bottom: 0.5pt;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.s-val {
  font-size: ${valueSize}pt;
  font-weight: 800;
  color: #000;
  line-height: 1.1;
  /* Long single words (Polycarbonate) have to break somewhere in a narrow
     column; hyphenate rather than splitting mid-word with no mark. */
  overflow-wrap: break-word;
  hyphens: auto;
}

.c-flags {
  font-size: 6pt;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5pt;
  color: #444;
  border-top: 0.5pt solid #ddd;
  padding: 3pt 11pt;
}

.c-notes {
  font-size: 6pt;
  color: #666;
  border-top: 0.5pt solid #ddd;
  padding: 3pt 11pt;
  font-style: italic;
}
</style>
</head>
<body>
<div class="sheet">

  <div class="tag">
    <div class="t-marker ${markerClass}"></div>
    <span class="t-name">${text(item.name) ?? EM_DASH}</span>
    ${typeLabel ? `<span class="t-type">${escapeHtml(typeLabel)}</span>` : ''}
  </div>

  <div class="cut-v"></div>
  <span class="cut-v-label">&#9988;</span>
  <div class="cut-h"></div>
  <span class="cut-h-label">&#9988; cut</span>

  <div class="card">
    <div class="c-head">
      <div class="c-name">${text(item.name) ?? EM_DASH}</div>
      ${
        manufacturer
          ? `<div class="c-mfr"${manufacturerStyle(manufacturer)}>${escapeHtml(manufacturer)}</div>`
          : ''
      }
    </div>
    ${
      typeLabel
        ? `<div class="c-type-row">
      <span class="c-type-box">${escapeHtml(typeLabel)}</span>
      <span class="c-type-desc">${escapeHtml(typeDesc)}</span>
    </div>`
        : ''
    }
    <div class="c-specs-grid">
      ${cells
        .map(
          ([label, value]) =>
            `<div><div class="s-label">${escapeHtml(label)}</div><div class="s-val">${value}</div></div>`
        )
        .join('\n      ')}
    </div>
    ${flags.length ? `<div class="c-flags">${flags.map(escapeHtml).join(' &middot; ')}</div>` : ''}
    ${notes ? `<div class="c-notes">${escapeHtml(notes)}</div>` : ''}
  </div>

</div>
<script>
  window.addEventListener('load', function () { window.print() })
</script>
</body>
</html>`
}
