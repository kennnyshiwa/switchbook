import assert from 'node:assert/strict'
import test from 'node:test'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

// Actual grid/modal -> browser JSON -> actual bulk/single PUT, then UI reload.
// Auth/database and lookup/navigation services are local boundaries; no live data.
for (const mode of ['bulk', 'modal'] as const) {
  test(`${mode}: quantity-only edits preserve timestamps; deliberate date changes and clears survive real PUT and reload`, async t => {
    const original = { id: 'owned', userId: 'owner', name: 'Clear fixture', manufacturer: 'A',
      notes: 'retain until deliberately cleared', actuationForce: 45, type: 'LINEAR', technology: 'MECHANICAL',
      topHousing: 'PC', quantity: 9, personalNotes: ' p\r\n'.repeat(2001), personalTags: ['keep'],
      imageUrl: '/uploads/legacy.jpg', primaryImageId: 'photo', images: [{ id: 'photo', url: '/uploads/legacy.jpg' }],
      dateObtained: '2024-04-01T12:13:14.567Z', progressiveSpring: false, doubleStage: false, masterSwitchId: null }
    const row: any = structuredClone(original)
    const db: any = { switch: {
      findFirst: async ({ where }: any) => where.id === row.id && where.userId === row.userId ? structuredClone(row) : null,
      update: async ({ data }: any) => { Object.assign(row, Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined))); return structuredClone(row) },
    } }
    db.$transaction = async (callback: any) => callback(db)
    const handler = await build({ entryPoints: [mode === 'bulk' ? 'src/app/api/switches/bulk/route.ts' : 'src/app/api/switches/[id]/route.ts'], bundle: true, write: false, platform: 'node', format: 'cjs', packages: 'external',
      plugins: [{ name: 'route-boundaries', setup(b) { b.onResolve({ filter: /^@\/lib\/(auth|prisma|with-rate-limit|performance-monitor)$/ }, args => ({ path: args.path, external: true })) } }] })
    const dependencies: Record<string, unknown> = {
      '@/lib/auth': { auth: async () => ({ user: { id: 'owner' } }) }, '@/lib/prisma': { prisma: db },
      '@/lib/with-rate-limit': { withSmartRateLimit: (f: unknown) => f },
      '@/lib/performance-monitor': { BulkOperationMonitor: class { addError() {} complete() { return {} } } },
    }
    const mod = { exports: {} as any }, nativeRequire = createRequire(import.meta.url)
    new Function('require', 'module', 'exports', 'setInterval', handler.outputFiles[0].text)((key: string) => dependencies[key] ?? nativeRequire(key), mod, mod.exports, () => 0)
    const stubs: Record<string, string> = {
      '@/components/SwitchImageManager': `export default ()=>null`,
      'next/navigation': `export const useRouter=()=>({refresh(){},push(){}})`,
      '@/contexts/ThemeContext': `export const useTheme=()=>({theme:'light'})`,
      'next/link': `import React from 'react';export default ({children,...p})=><a {...p}>{children}</a>`,
      '@/utils/manufacturerValidation': `export const validateManufacturers=async()=>new Map()`,
      '@/utils/materials': `export const getMaterials=async()=>[{id:'pc',name:'PC'}]`,
      '@/utils/stemShapes': `export const getStemShapes=async()=>[{id:'mx',name:'MX'}]`,
    }
    const bundle = await build({ stdin: { contents: mode === 'bulk'
        ? `import React from 'react';import {createRoot} from 'react-dom/client';import BulkEdit from './src/app/dashboard/bulk-edit/page';createRoot(document.getElementById('root')).render(<BulkEdit/>);`
        : `import React from 'react';import {createRoot} from 'react-dom/client';import Edit from './src/components/EditSwitchModal';const root=createRoot(document.getElementById('root'));fetch('/api/switches/owned').then(r=>r.json()).then(row=>root.render(<Edit switch={row} onClose={()=>{window.saved=true}} onSwitchUpdated={()=>{}}/>));`, resolveDir: process.cwd(), loader: 'tsx' },
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
      if (request.method() === 'GET') {
        if (mode === 'modal' && path === '/api/switches/owned') {
          const response = await mod.exports.GET(new Request(request.url()), { params: Promise.resolve({ id: 'owned' }) })
          assert.equal(response.status, 200)
          return route.fulfill({ json: await response.json() })
        }
        return route.fulfill({ json: path === '/api/switches' ? [row] : path === '/api/user/tags' ? { tags: [] }
          : path.endsWith('/sync-master') ? { isLinkedToMaster: false, hasUpdates: false } : [] })
      }
      assert.equal(request.method(), 'PUT')
      assert.equal(path, mode === 'bulk' ? '/api/switches/bulk' : '/api/switches/owned')
      const body = request.postDataJSON(); payloads.push(mode === 'bulk' ? body.switches[0] : body)
      const response = await mod.exports.PUT(new Request(`http://localhost${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), { params: Promise.resolve({ id: 'owned' }) })
      const result = await response.json()
      assert.equal(response.status, 200, JSON.stringify(result))
      if (mode === 'bulk') { assert.equal(result.results.success, 1); assert.equal(result.results.failed, 0) }
      return route.fulfill({ status: response.status, json: result })
    })
    await page.goto(`http://127.0.0.1:${(server.address() as { port: number }).port}`)
    const input = async (field: 'quantity' | 'dateObtained') => {
      if (mode === 'modal') {
        const locator = page.locator(`input[name="${field}"]`)
        await locator.waitFor()
        return locator
      }
      await page.locator('input[placeholder="Notes..."]').waitFor()
      const headers = await page.locator('thead th').allTextContents()
      const index = headers.findIndex(text => text.trim() === (field === 'quantity' ? 'Quantity' : 'Date Obtained'))
      assert.ok(index >= 0, JSON.stringify(headers))
      return page.locator('tbody tr').first().locator('td').nth(index).locator('input')
    }
    const save = async () => {
      await page.waitForTimeout(450) // Let the actual grid's debounce settle.
      await page.getByRole('button', { name: mode === 'bulk' ? 'Save 1 Changes' : 'Update Switch', exact: true }).click()
      if (mode === 'bulk') await page.getByText('Changes Saved Successfully!', { exact: true }).waitFor()
      else await page.waitForFunction(() => (window as any).saved === true)
    }
    const timestamp = () => row.dateObtained == null ? null : new Date(row.dateObtained).toISOString()
    const assertDate = (expected: string | null, omitted: boolean) => {
      t.diagnostic(JSON.stringify({ mode, save: payloads.length, quantity: row.quantity, timestamp: timestamp(),
        dateSent: Object.hasOwn(payloads.at(-1), 'dateObtained'), datePayload: payloads.at(-1).dateObtained }))
      assert.equal(timestamp(), expected, 'Quantity-only saves must not truncate an untouched timestamp')
      assert.equal(Object.hasOwn(payloads.at(-1), 'dateObtained'), !omitted, 'Unchanged dates must be omitted; changes/clears explicit')
      for (const key of ['imageUrl', 'primaryImageId', 'images']) {
        assert.equal(Object.hasOwn(payloads.at(-1), key), false)
        assert.deepEqual(row[key], (original as any)[key])
      }
      if (mode === 'bulk') assert.equal(Object.hasOwn(payloads.at(-1), 'personalNotes'), false)
      assert.equal(row.personalNotes, original.personalNotes)
      assert.deepEqual(row.personalTags, original.personalTags)
    }
    const reload = async (date: string, quantity: string) => {
      await page.reload()
      assert.equal(await (await input('dateObtained')).inputValue(), date)
      assert.equal(await (await input('quantity')).inputValue(), quantity)
    }

    assert.equal(await (await input('dateObtained')).inputValue(), '2024-04-01')
    await (await input('quantity')).fill('0')
    await save()
    assert.equal(payloads.at(-1).quantity, 0); assert.equal(row.quantity, 0)
    assertDate(original.dateObtained, true)
    await reload('2024-04-01', '0')

    // Reverting a date edit must also preserve the original time and milliseconds.
    await (await input('dateObtained')).fill('2024-05-02')
    await page.waitForTimeout(450)
    await (await input('dateObtained')).fill('2024-04-01')
    await (await input('quantity')).fill('')
    await save()
    assert.equal(payloads.at(-1).quantity, null); assert.equal(row.quantity, null)
    assertDate(original.dateObtained, true)
    await reload('2024-04-01', '')

    await (await input('dateObtained')).fill('2024-06-15')
    await save()
    assert.equal(payloads.at(-1).dateObtained, '2024-06-15')
    assertDate('2024-06-15T00:00:00.000Z', false)
    await reload('2024-06-15', '')

    await (await input('dateObtained')).fill('')
    await save()
    assert.equal(payloads.at(-1).dateObtained, '')
    assertDate(null, false)
    await reload('', '')

    // An already-unknown date, including a reverted edit, also stays omitted.
    await (await input('dateObtained')).fill('2024-07-01')
    await page.waitForTimeout(450)
    await (await input('dateObtained')).fill('')
    await (await input('quantity')).fill('1')
    await save()
    assert.equal(row.quantity, 1)
    assertDate(null, true)
    await reload('', '1')
    assert.equal(payloads.length, 5)
    assert.deepEqual(errors, [])
  })
}
