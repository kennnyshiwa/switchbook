import test from 'node:test'
import assert from 'node:assert/strict'
import { build } from 'esbuild'
import { createRequire } from 'node:module'
import { Prisma } from '@prisma/client'
import {
  SWITCH_CSV_COLUMNS,
  SWITCH_CSV_EXCLUDED_FIELDS,
  csvRowToSwitchData,
  decodeCsvTags,
  matchSwitchCsvHeader,
  parseSwitchCsvRow,
  mapSwitchCsvHeaders,
  parseCsv,
  switchesToCsv,
} from '../src/lib/switchCsv'

// Export side runs the real GET /api/switches/export route; import side runs
// the bulk-upload page's parsing helpers and then the real POST /api/switches
// route, so the whole user-visible round trip is covered.

const nativeRequire = createRequire(import.meta.url)
const bundle = (entry: string) => build({
  entryPoints: [entry],
  bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
  plugins: [{ name: 'route-boundaries', setup(builder) {
    builder.onResolve({ filter: /^@\/(lib\/(auth|prisma|with-rate-limit)|utils\/manufacturerNormalization)$/ }, args => ({ path: args.path, external: true }))
  } }]
})
const exportBundle = bundle('src/app/api/switches/export/route.ts')
const createBundle = bundle('src/app/api/switches/route.ts')

async function load(built: ReturnType<typeof bundle>, prisma: unknown) {
  const dependencies: Record<string, unknown> = {
    '@/lib/auth': { auth: async () => ({ user: { id: 'owner-1' } }) },
    '@/lib/prisma': { prisma },
    '@/lib/with-rate-limit': { withSmartRateLimit: (handler: unknown) => handler },
    '@/utils/manufacturerNormalization': { normalizeManufacturerName: async (name: string) => name },
  }
  const mod = { exports: {} as any }
  new Function('require', 'module', 'exports', (await built).outputFiles[0].text)(
    (name: string) => dependencies[name] || nativeRequire(name), mod, mod.exports)
  return mod.exports
}

// Notes: 600+ characters (above the old 500 cap, inside the 2000 cap).
// Personal notes: well over 2000, inside their own 5000 cap.
const LONG_MASTER_NOTES = ('Master notes, "quoted", with commas\r\nand lines. ').repeat(14)
const LONG_PERSONAL_NOTES = ('  Personal — ünïcödé, "quotes"\n🎹 ').repeat(140)

const NASTY_TAGS = ['comma, tag', 'quote "tag"', 'line\nbreak', '[not json', 'emoji 🎹 键', '  padded  ', 'semi;colon']

// Every exported column is populated, with values that break naive CSV code.
const linked = {
  id: 'sw-linked', userId: 'owner-1', createdAt: new Date(), updatedAt: new Date(),
  name: 'Gateron "Milky" Yellow, Pro\r\nv2 🌟 黄轴',
  chineseName: '黄轴, "专业版"\n第二代',
  type: 'SILENT_TACTILE', technology: 'ELECTRO_CAPACITIVE',
  magnetOrientation: 'Diagonal, "45°"\nish', magnetPosition: 'Off, "near" edge', magnetPolarity: 'N, "S"',
  initialForce: 30.25, initialMagneticFlux: 0.1 + 0.2, bottomOutMagneticFlux: 9999.5,
  pcbThickness: '1.6"mm,', compatibility: 'MX, "Alps"\r\nhybrid',
  manufacturer: 'Acme, "Switch" Co.\nÜnïcödé',
  springWeight: '62g, "progressive"\n68g', springLength: '22mm, "long"',
  actuationForce: 45.5, tactileForce: 55.125, tactilePosition: 1.75, bottomOutForce: 999.99,
  progressiveSpring: true, doubleStage: true, clickType: 'CLICK_JACKET',
  preTravel: 1.95, bottomOut: 3.6,
  topHousing: 'PC, "frosted"', bottomHousing: 'Nylon\n"PA66"', stem: 'POM, "long pole"',
  topHousingColor: 'Clear, "smoky"', bottomHousingColor: 'Black\r\nmatte', stemColor: 'Yellow "ish"',
  stemShape: 'Box, "cross"', markings: 'Logo, "AC"\non top\r\nand side',
  frankenTop: 'Cherry, "vintage" top', frankenBottom: 'Gateron\nbottom', frankenStem: 'NK "cream" stem',
  notes: LONG_MASTER_NOTES,
  personalNotes: LONG_PERSONAL_NOTES,
  personalTags: NASTY_TAGS,
  quantity: 0,
  dateObtained: new Date('2024-02-29T00:00:00.000Z'),
  masterSwitchId: 'master-1', masterSwitchVersion: 3, isModified: false, modifiedFields: [],
  shareableId: 'share-secret', primaryImageId: null, imageUrl: null,
}

const unlinked = {
  ...linked,
  id: 'sw-unlinked',
  name: '=SUM(A1), "formula" name',
  chineseName: '  前后空格 ',
  type: 'LINEAR', technology: 'MAGNETIC', clickType: 'CLICK_BAR',
  // Zero is a real value and must not turn into "not set".
  initialForce: 0, actuationForce: 0, tactilePosition: 0, preTravel: 0, bottomOutMagneticFlux: 0,
  progressiveSpring: false, doubleStage: false,
  notes: 'Own notes, with "quotes"\nand a second line',
  personalNotes: 'Separate personal notes, still kept',
  personalTags: ['single'],
  quantity: 1234,
  dateObtained: new Date('1999-12-31T00:00:00.000Z'),
  masterSwitchId: null, masterSwitchVersion: null,
}

const exportedKeys = SWITCH_CSV_COLUMNS.map(column => column.key)
const LINK_ONLY_KEYS = ['masterSwitchId', 'masterSwitchVersion']

const isBlank = (value: unknown) =>
  value === null || value === undefined || value === '' || (Array.isArray(value) && value.length === 0)

test('round-trip fixtures populate every exported column (so the round trip cannot pass vacuously)', () => {
  for (const key of exportedKeys) {
    assert.ok(!isBlank((linked as any)[key]), `linked fixture is missing a value for exported column "${key}"`)
    if (!LINK_ONLY_KEYS.includes(key)) assert.ok(!isBlank((unlinked as any)[key]), `unlinked fixture is missing a value for "${key}"`)
  }
  assert.ok(linked.notes.length > 600 && linked.notes.length <= 2000)
  assert.ok(linked.personalNotes.length > 2000 && linked.personalNotes.length <= 5000, String(linked.personalNotes.length))
})

test('export columns cover every user-facing Switch scalar field in the Prisma schema', () => {
  const model = Prisma.dmmf.datamodel.models.find(candidate => candidate.name === 'Switch')
  assert.ok(model, 'Switch model in DMMF')
  const scalarFields = model.fields.filter(field => field.kind === 'scalar' || field.kind === 'enum').map(field => field.name)
  const excluded = Object.keys(SWITCH_CSV_EXCLUDED_FIELDS)
  const missing = scalarFields.filter(field => !exportedKeys.includes(field as never) && !excluded.includes(field))
  assert.deepEqual(missing, [], `Switch fields neither exported nor explicitly excluded: ${missing.join(', ')}`)
  for (const key of [...exportedKeys, ...excluded]) assert.ok(scalarFields.includes(key), `${key} is a Switch scalar field`)
  assert.deepEqual(exportedKeys.filter(key => excluded.includes(key)), [], 'a field is both exported and excluded')
  assert.equal(new Set(exportedKeys).size, exportedKeys.length, 'duplicate export column')
  assert.equal(new Set(SWITCH_CSV_COLUMNS.map(column => column.header)).size, exportedKeys.length, 'duplicate export header')
  for (const key of ['personalNotes', 'personalTags', 'quantity', 'dateObtained', 'frankenTop', 'frankenBottom', 'frankenStem', 'markings', 'stemColor', 'topHousingColor', 'bottomHousingColor', 'stemShape']) {
    assert.ok(exportedKeys.includes(key as never), `${key} exported`)
  }
})

test('every export header maps back to its own field on import', () => {
  const headers = SWITCH_CSV_COLUMNS.map(column => column.header)
  const mapping = mapSwitchCsvHeaders(headers)
  headers.forEach((header, index) => assert.equal(mapping[String(index)], SWITCH_CSV_COLUMNS[index].key, header))
})

test('export -> bulk-upload import round trip preserves every field for linked and unlinked switches', async () => {
  const exportRoute = await load(exportBundle, { switch: { findMany: async () => [linked, unlinked] } })
  const response = await exportRoute.GET(new Request('http://localhost/api/switches/export'))
  assert.equal(response.status, 200)
  assert.match(response.headers.get('Content-Type'), /^text\/csv/)
  const bytes = new Uint8Array(await response.arrayBuffer())
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf], 'export starts with a UTF-8 BOM')
  // Decode keeping the BOM (fetch's text() would strip it) to prove the parser handles it.
  const csv = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes)
  assert.equal(csv.charCodeAt(0), 0xfeff)
  assert.ok(!csv.includes('share-secret'), 'share token is not exported')

  // Bulk-upload page: parse, auto-map headers, convert rows.
  const [headers, ...rows] = parseCsv(csv)
  assert.deepEqual(headers, SWITCH_CSV_COLUMNS.map(column => column.header))
  assert.equal(rows.length, 2)
  const mapping = mapSwitchCsvHeaders(headers)
  const parsed = rows.map(row => csvRowToSwitchData(row, mapping))

  // Bulk-upload page posts each row to /api/switches.
  const created: any[] = []
  const prisma: any = {
    switch: {
      count: async () => 0,
      create: async ({ data }: any) => { created.push(data); return { id: `new-${created.length}`, ...data, images: [] } },
    },
    masterSwitch: {
      findUnique: async ({ where }: any) => where.id === 'master-1'
        ? { status: 'APPROVED', version: 7, imageUrl: null, images: [] }
        : null,
    },
    $transaction: async (fn: any) => fn(prisma),
  }
  const createRoute = await load(createBundle, prisma)
  for (const row of parsed) {
    const res = await createRoute.POST(new Request('http://localhost/api/switches', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(row),
    }))
    assert.equal(res.status, 200, JSON.stringify(await res.clone().json()))
  }
  assert.equal(created.length, 2)

  for (const [index, original] of [linked, unlinked].entries()) {
    const stored = created[index]
    for (const key of exportedKeys) {
      if (key === 'dateObtained') {
        assert.equal(stored.dateObtained.getTime(), original.dateObtained.getTime(), `${original.id}.dateObtained`)
      } else if (LINK_ONLY_KEYS.includes(key)) {
        // Not set on an unlinked create, so the column stays NULL.
        assert.equal(stored[key] ?? null, (original as any)[key], `${original.id}.${key}`)
      } else {
        assert.deepEqual(stored[key], (original as any)[key], `${original.id}.${key}`)
      }
    }
  }
  // Linked switch: notes mirror the master, personal notes stay separate, and
  // the link keeps the (older) exported master version.
  assert.equal(created[0].masterSwitchId, 'master-1')
  assert.equal(created[0].masterSwitchVersion, 3)
  assert.equal(created[0].isModified, true)
  assert.equal(created[0].notes, linked.notes)
  assert.equal(created[0].personalNotes, linked.personalNotes)
  assert.notEqual(created[0].notes, created[0].personalNotes)
  assert.equal(created[0].quantity, 0, 'zero quantity survives')
  assert.equal(created[1].masterSwitchId, undefined)
  for (const key of ['initialForce', 'actuationForce', 'tactilePosition', 'preTravel', 'bottomOutMagneticFlux']) {
    assert.equal(created[1][key], 0, `${key} = 0 survives`)
  }
  assert.equal(created[1].personalNotes, unlinked.personalNotes)
  assert.deepEqual(created[1].personalTags, ['single'])
})

test('CSV parser handles RFC 4180 quoting, embedded newlines, CRLF and BOM', () => {
  const text = '﻿"a","b ""q""",c\r\n"multi\r\nline, with comma",,"x"\n\n  spaced , "  kept  "\r'
  assert.deepEqual(parseCsv(text), [
    ['a', 'b "q"', 'c'],
    ['multi\r\nline, with comma', '', 'x'],
    ['spaced', '  kept  '],
  ])
})

test('legacy export headers and hand-written CSVs still import', () => {
  const legacy = [
    '"Switch Name","Chinese Name","Type","Technology","Magnetic Pole Orientation","Spring Weight","Actuation Force (g)","Notes","Date Obtained"',
    '"Holy Panda","","tactile","hall effect","h","67 G","67","Great, ""thocky""","2023-05-01"',
  ].join('\n')
  const [headers, ...rows] = parseCsv(legacy)
  const data = csvRowToSwitchData(rows[0], mapSwitchCsvHeaders(headers))
  assert.deepEqual(data, {
    name: 'Holy Panda', type: 'TACTILE', technology: 'MAGNETIC', magnetOrientation: 'Horizontal',
    springWeight: '67g', actuationForce: 67, notes: 'Great, "thocky"', dateObtained: '2023-05-01',
  })

  const handWritten = 'name,qty,tags,personal notes\nBox Jade, 12 , "clicky, box",late night\n'
  const [hwHeaders, ...hwRows] = parseCsv(handWritten)
  assert.deepEqual(csvRowToSwitchData(hwRows[0], mapSwitchCsvHeaders(hwHeaders)), {
    name: 'Box Jade', quantity: 12, personalTags: ['clicky', 'box'], personalNotes: 'late night',
  })
})

test('personal tags decode JSON arrays losslessly and fall back to delimited lists', () => {
  assert.deepEqual(decodeCsvTags(JSON.stringify(NASTY_TAGS)), NASTY_TAGS)
  assert.deepEqual(decodeCsvTags('a; b ,c'), ['a', 'b', 'c'])
  assert.deepEqual(decodeCsvTags('[broken'), ['[broken'])
  assert.deepEqual(decodeCsvTags(''), [])
  assert.equal(switchesToCsv([{ name: 'x', personalTags: [] }]).split('\r\n')[1].split(',').length, SWITCH_CSV_COLUMNS.length)
})

test('blank cells in mapped Quantity / Personal Notes / Personal Tags columns clear them; unmapped columns stay unset', () => {
  const [headers, ...rows] = parseCsv('Switch Name,Quantity,Personal Notes,Personal Tags\r\nJade,,,\r\n')
  assert.deepEqual(csvRowToSwitchData(rows[0], mapSwitchCsvHeaders(headers)), { name: 'Jade', quantity: null, personalNotes: '', personalTags: [] })
  const [plainHeaders, ...plainRows] = parseCsv('Switch Name,Notes\r\nJade,\r\n')
  const data = csvRowToSwitchData(plainRows[0], mapSwitchCsvHeaders(plainHeaders))
  assert.deepEqual(data, { name: 'Jade' })
  for (const key of ['quantity', 'personalNotes', 'personalTags', 'notes']) assert.equal(key in data, false, key)
})

test('enum, number and name cells are trimmed; free text is kept verbatim', () => {
  const csv = 'Switch Name,Type,Technology,Click Type,Magnet Polarity,Actuation Force (g),Quantity,Notes\r\n' +
    '"  Holy Panda  "," tactile "," hall effect "," click bar "," n "," 67 "," 3 ","  keep  this\n"\r\n'
  const [headers, ...rows] = parseCsv(csv)
  assert.deepEqual(csvRowToSwitchData(rows[0], mapSwitchCsvHeaders(headers)), {
    name: 'Holy Panda', type: 'TACTILE', technology: 'MAGNETIC', clickType: 'CLICK_BAR', magnetPolarity: 'North',
    actuationForce: 67, quantity: 3, notes: '  keep  this\n',
  })
})

test('hand-written quantities: "1.0" is accepted; invalid values are reported, not dropped', () => {
  const mapping = mapSwitchCsvHeaders(['Switch Name', 'Quantity'])
  assert.deepEqual(parseSwitchCsvRow(['A', '1.0'], mapping), { data: { name: 'A', quantity: 1 }, errors: {} })
  for (const bad of ['-1', '2.5', '1,000', 'abc', '99999999']) {
    const { data, errors } = parseSwitchCsvRow(['A', bad], mapping)
    assert.equal('quantity' in data, false, bad)
    assert.match(errors.quantity ?? '', /whole number/, bad)
    assert.ok(errors.quantity?.includes(bad), `error names the bad value ${bad}`)
  }
})

test('fuzzy headers prefer the specific personal fields and never map a bare "Master"', () => {
  assert.equal(matchSwitchCsvHeader('Personal Notes (private)'), 'personalNotes')
  assert.equal(matchSwitchCsvHeader('My personalTags column'), 'personalTags')
  assert.equal(matchSwitchCsvHeader('Notes (public)'), 'notes')
  assert.equal(matchSwitchCsvHeader('Master'), null)
  assert.equal(matchSwitchCsvHeader('Master ID'), 'masterSwitchId')
  assert.equal(matchSwitchCsvHeader('masterSwitchId (link)'), 'masterSwitchId')
  assert.equal(matchSwitchCsvHeader('Master Version'), 'masterSwitchVersion')
  assert.equal(matchSwitchCsvHeader('Master Switch Version'), 'masterSwitchVersion')
  assert.equal(matchSwitchCsvHeader('Version'), null)
  assert.equal(matchSwitchCsvHeader('Firmware Version'), null)
  assert.equal(matchSwitchCsvHeader('Switch ID'), null)
})

// A master record carrying every tracked field.
const FULL_MASTER = {
  id: 'master-9', status: 'APPROVED', version: 5, imageUrl: null, images: [],
  name: 'Oil King', chineseName: '油王', type: 'LINEAR', technology: 'MECHANICAL', manufacturer: 'Gateron',
  actuationForce: 55, bottomOutForce: 65, preTravel: 2, bottomOut: 4, springWeight: '55g', springLength: '22mm',
  notes: 'Factory lubed', topHousing: 'PA12', bottomHousing: 'PA12', stem: 'POM', topHousingColor: 'Black',
  bottomHousingColor: 'Black', stemColor: 'Black', stemShape: 'MX', markings: 'G', magnetOrientation: null,
  magnetPosition: null, magnetPolarity: null, initialForce: 40, initialMagneticFlux: null, bottomOutMagneticFlux: null,
  pcbThickness: null, compatibility: 'MX', tactileForce: null, progressiveSpring: false, doubleStage: false, clickType: null,
}

async function importOne(record: Record<string, unknown>) {
  const created: any[] = []
  const prisma: any = {
    switch: { count: async () => 0, create: async ({ data }: any) => { created.push(data); return { id: 'new', ...data, images: [] } } },
    masterSwitch: { findUnique: async ({ where }: any) => (where.id === FULL_MASTER.id ? FULL_MASTER : null) },
    $transaction: async (fn: any) => fn(prisma),
  }
  const route = await load(createBundle, prisma)
  const [headers, ...rows] = parseCsv(switchesToCsv([record]))
  const body = csvRowToSwitchData(rows[0], mapSwitchCsvHeaders(headers))
  const res = await route.POST(new Request('http://localhost/api/switches', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }))
  assert.equal(res.status, 200, JSON.stringify(await res.clone().json()))
  return created[0]
}

const { id: _masterId, status: _status, version: _version, imageUrl: _imageUrl, images: _images, ...masterValues } = FULL_MASTER
const exportedLinked = { ...masterValues, masterSwitchId: FULL_MASTER.id, personalNotes: 'mine', quantity: 2 }

test('re-linking an export at an older version with a customised field keeps the version and marks it modified', async () => {
  const stored = await importOne({ ...exportedLinked, masterSwitchVersion: 2, actuationForce: 62 })
  assert.equal(stored.masterSwitchId, FULL_MASTER.id)
  assert.equal(stored.masterSwitchVersion, 2)
  assert.equal(stored.isModified, true)
  assert.deepEqual(stored.modifiedFields, ['actuationForce'])
})

test('re-linking an unmodified export is not marked modified', async () => {
  const stored = await importOne({ ...exportedLinked, masterSwitchVersion: 5 })
  assert.equal(stored.masterSwitchVersion, 5)
  assert.equal(stored.isModified, false)
  assert.deepEqual(stored.modifiedFields, [])
  assert.equal(stored.quantity, 2)
})

test('an exported version newer than the master (or invalid) falls back to the current version', async () => {
  assert.equal((await importOne({ ...exportedLinked, masterSwitchVersion: 9 })).masterSwitchVersion, 5)
  assert.equal((await importOne({ ...exportedLinked, masterSwitchVersion: 0 })).masterSwitchVersion, 5)
})

test('adding from the master database (no version sent) behaves as before: current version, not modified', async () => {
  const created: any[] = []
  const prisma: any = {
    switch: { count: async () => 0, create: async ({ data }: any) => { created.push(data); return { id: 'new', ...data, images: [] } } },
    masterSwitch: { findUnique: async () => FULL_MASTER },
    $transaction: async (fn: any) => fn(prisma),
  }
  const route = await load(createBundle, prisma)
  // AddSwitchModal fills only some master fields, so values differ from the master.
  const res = await route.POST(new Request('http://localhost/api/switches', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Oil King', manufacturer: 'Gateron', markings: '', personalTags: [], masterSwitchId: FULL_MASTER.id, copyMasterImages: true }),
  }))
  assert.equal(res.status, 200)
  assert.equal(created[0].masterSwitchVersion, 5)
  assert.equal(created[0].isModified, false)
  assert.equal('modifiedFields' in created[0], false)
})

test('short rows leave missing trailing cells absent; only an explicitly empty cell clears', () => {
  const [headers, ...rows] = parseCsv('Switch Name,Notes,Quantity,Personal Notes,Personal Tags\r\nShort,hi\r\nExplicit,hi,,,\r\n')
  const mapping = mapSwitchCsvHeaders(headers)
  const short = csvRowToSwitchData(rows[0], mapping)
  assert.deepEqual(short, { name: 'Short', notes: 'hi' })
  for (const key of ['quantity', 'personalNotes', 'personalTags']) assert.equal(key in short, false, key)
  assert.deepEqual(csvRowToSwitchData(rows[1], mapping), { name: 'Explicit', notes: 'hi', quantity: null, personalNotes: '', personalTags: [] })
})
