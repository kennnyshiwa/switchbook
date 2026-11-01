import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

// Actual grid -> JSON over the browser boundary -> actual bulk PUT. Only auth,
// database, lookup services and navigation are substituted; no live user data.
test('bulk grid explicitly clears cells through real PUT and reload, preserving zero and omitted personal fields', async t => {
  const original = { id: 'owned', userId: 'owner', name: 'Clear fixture', manufacturer: 'A',
    notes: 'retain until deliberately cleared', actuationForce: 45, type: 'LINEAR', technology: 'MECHANICAL',
    topHousing: 'PC', quantity: 9, personalNotes: ' p\r\n'.repeat(2001), personalTags: ['keep'],
    imageUrl: '/uploads/legacy.jpg', primaryImageId: 'photo', images: [{ id: 'photo', url: '/uploads/legacy.jpg' }],
    dateObtained: null, progressiveSpring: false, doubleStage: false, masterSwitchId: null }
  const row: any = structuredClone(original)
  const db = { switch: {
    findFirst: async ({ where }: any) => where.id === row.id && where.userId === row.userId ? structuredClone(row) : null,
    update: async ({ data }: any) => { Object.assign(row, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))); return structuredClone(row) },
  } }
  const handler = await build({ entryPoints: ['src/app/api/switches/bulk/route.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
    plugins: [{ name: 'route-boundaries', setup(b) { b.onResolve({ filter: /^@\/lib\/(auth|prisma|with-rate-limit|performance-monitor)$/ }, args => ({ path: args.path, external: true })) } }] })
  const dependencies: Record<string, unknown> = {
    '@/lib/auth': { auth: async () => ({ user: { id: 'owner' } }) }, '@/lib/prisma': { prisma: db },
    '@/lib/with-rate-limit': { withSmartRateLimit: (f: unknown) => f },
    '@/lib/performance-monitor': { BulkOperationMonitor: class { addError() {} complete() { return {} } } },
  }
  const mod = { exports: {} as any }, nativeRequire = createRequire(import.meta.url)
  new Function('require', 'module', 'exports', 'setInterval', handler.outputFiles[0].text)((key: string) => dependencies[key] ?? nativeRequire(key), mod, mod.exports, () => 0)
  const stubs: Record<string, string> = {
    'next/link': `import React from 'react';export default ({children,...p})=><a {...p}>{children}</a>`,
    '@/utils/manufacturerValidation': `export const validateManufacturers=async()=>new Map()`,
    '@/utils/materials': `export const getMaterials=async()=>[{id:'pc',name:'PC'}]`,
    '@/utils/stemShapes': `export const getStemShapes=async()=>[]`,
  }
  const bundle = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';import BulkEdit from './src/app/dashboard/bulk-edit/page';createRoot(document.getElementById('root')).render(<BulkEdit/>);`, resolveDir: process.cwd(), loader: 'tsx' },
    bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
    plugins: [{ name: 'ui-boundaries', setup(b) {
      b.onResolve({ filter: /.*/ }, args => stubs[args.path] ? { path: args.path, namespace: 'stub' } : undefined)
      b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents: stubs[args.path], loader: 'tsx', resolveDir: process.cwd() }))
    } }] })
  const server = createServer((req, res) => { res.setHeader('Content-Type', req.url === '/bundle.js' ? 'application/javascript' : 'text/html'); res.end(req.url === '/bundle.js' ? bundle.outputFiles[0].text : '<div id="root"></div><script src="/bundle.js"></script>') })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())))
  const browser = await chromium.launch({ headless: true, executablePath: process.env.BROWSER_CHROMIUM_PATH })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
  page.setDefaultTimeout(7000)
  const errors: string[] = [], payloads: any[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname
    if (request.method() === 'GET') return route.fulfill({ json: path === '/api/switches' ? [row] : path === '/api/user/tags' ? { tags: [] } : [] })
    assert.equal(path, '/api/switches/bulk')
    const body = request.postDataJSON(); payloads.push(body.switches[0])
    const response = await mod.exports.PUT(new Request('http://localhost/api/switches/bulk', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }))
    const result = await response.json()
    assert.equal(response.status, 200); assert.equal(result.results.success, 1); assert.equal(result.results.failed, 0)
    return route.fulfill({ status: response.status, json: result })
  })
  await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}`)
  const cell = async (label: string) => {
    await page.locator('input[placeholder="Notes..."]').waitFor()
    const headers = await page.locator('thead th').allTextContents()
    const index = headers.findIndex(text => text.trim() === label)
    assert.ok(index >= 0, JSON.stringify(headers))
    return page.locator('tbody tr').first().locator('td').nth(index)
  }
  const save = async () => {
    // Debounced cells must settle before saving, as in the QA repro.
    await page.waitForTimeout(450)
    await page.getByRole('button', { name: 'Save 1 Changes', exact: true }).click()
    await page.getByText('Changes Saved Successfully!', { exact: true }).waitFor()
  }
  const assertPersonalPreserved = () => {
    for (const key of ['personalNotes', 'imageUrl', 'primaryImageId', 'images']) {
      assert.equal(Object.hasOwn(payloads.at(-1), key), false, `${key} must remain omitted`)
      assert.deepEqual(row[key], (original as any)[key], key)
    }
    assert.deepEqual(row.personalTags, original.personalTags)
  }
  await (await cell('Notes')).locator('input').fill('')
  await (await cell('Actuation (g)')).locator('input').fill('')
  await (await cell('Type')).locator('select').selectOption('')
  await (await cell('Top Housing')).locator('select').selectOption('')
  await (await cell('Quantity')).locator('input').fill('0')
  await save()
  for (const key of ['notes', 'actuationForce', 'type', 'topHousing']) {
    assert.ok(Object.hasOwn(payloads[0], key), `${key} clear must be explicit`)
    assert.equal(row[key], null, key)
  }
  assert.equal(payloads[0].quantity, 0); assert.equal(row.quantity, 0); assertPersonalPreserved()
  await page.reload()
  assert.equal(await (await cell('Notes')).locator('input').inputValue(), '')
  assert.equal(await (await cell('Actuation (g)')).locator('input').inputValue(), '')
  assert.equal(await (await cell('Type')).locator('select').inputValue(), '')
  assert.equal(await (await cell('Top Housing')).locator('select').inputValue(), '')
  assert.equal(await (await cell('Quantity')).locator('input').inputValue(), '0')
  await (await cell('Quantity')).locator('input').fill('')
  await save()
  assert.equal(payloads[1].quantity, null); assert.equal(row.quantity, null); assertPersonalPreserved()
  await page.reload()
  assert.equal(await (await cell('Quantity')).locator('input').inputValue(), '')
  // A genuine zero measurement remains distinct from a cleared measurement.
  await (await cell('Actuation (g)')).locator('input').fill('0')
  await save()
  assert.equal(row.actuationForce, 0); assert.equal(row.quantity, null); assertPersonalPreserved()
  await page.reload()
  assert.equal(await (await cell('Actuation (g)')).locator('input').inputValue(), '0')
  assert.deepEqual(errors, [])
})
