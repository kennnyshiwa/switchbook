import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

const cachedChromium = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1161/chrome-mac/headless_shell`
const executablePath = process.env.BROWSER_CHROMIUM_PATH || (existsSync(cachedChromium) ? cachedChromium : undefined)

test('exact SwitchesDB dialog preserves staged UI state and never mutates', async t => {
  const bundle = await build({
    stdin: {
      loader: 'tsx',
      resolveDir: process.cwd(),
      contents: `
        import React, { useState } from 'react'
        import { createRoot } from 'react-dom/client'
        import ForceCurveLookupButton from './src/components/ForceCurveLookupButton'
        function Harness() {
          const [open, setOpen] = useState(null)
          const [master, setMaster] = useState('master-17')
          const [reason, setReason] = useState('verified exact identity')
          const [staged] = useState('ATTACH_SUGGESTION')
          return <main>
            <div style={{height: '480px'}}>preserved page content</div>
            <label>Selected master<input aria-label="Selected master" value={master} onChange={event => setMaster(event.target.value)} /></label>
            <label>Override reason<textarea aria-label="Override reason" value={reason} onChange={event => setReason(event.target.value)} /></label>
            <output aria-label="Staged action">{staged}</output>
            <ForceCurveLookupButton url="https://switchesdb.switchbook.app/#X%20Green~TG.csv" label="X Green" open={open === 'x'} onOpenChange={value => setOpen(value ? 'x' : null)} />
            <ForceCurveLookupButton url="https://switchesdb.switchbook.app/#Variant%2051000%20Actuations~TG.csv" label="Variant 51000 Actuations" open={open === 'variant'} onOpenChange={value => setOpen(value ? 'variant' : null)} buttonLabel="View actuation curve in SwitchesDB" />
            <div style={{height: '480px'}} />
          </main>
        }
        createRoot(document.getElementById('root')).render(<Harness />)
      `,
    },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
    write: false,
  })

  const browser = await chromium.launch({ executablePath, headless: true })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
  const requests: string[] = []
  const pageErrors: string[] = []
  page.on('request', request => requests.push(request.method()))
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('https://switchesdb.switchbook.app/**', route => route.fulfill({ contentType: 'text/html', body: '<title>SwitchesDB fixture</title><p>exact curve loaded</p>' }))
  await page.setContent(`<!doctype html><html class="dark"><head><style>
    body { margin: 0; background: #111827; color: white; }
    .fixed { position: fixed; } .inset-0 { inset: 0; } .min-h-11 { min-height: 44px; } .min-w-11 { min-width: 44px; }
    .w-full { width: 100%; } .h-full { height: 100%; } .flex { display: flex; } .flex-col { flex-direction: column; }
    .items-center { align-items: center; } .justify-center { justify-content: center; } .flex-1 { flex: 1; } .overflow-hidden { overflow: hidden; }
    .h-\\[calc\\(100dvh-1rem\\)\\] { height: calc(100dvh - 1rem); } button { margin: 4px; }
  </style></head><body><div id="root"></div></body></html>`)
  await page.addScriptTag({ content: bundle.outputFiles[0].text })
  await page.waitForTimeout(100)
  assert.deepEqual(pageErrors, [])

  const primary = page.getByRole('button', { name: 'View exact curve in SwitchesDB' })
  await primary.waitFor()
  await page.getByLabel('Selected master').fill('master-preserved')
  await page.getByLabel('Override reason').fill('preserve this override reason')
  await page.evaluate(() => window.scrollTo(0, 430))
  const scrollBefore = await page.evaluate(() => window.scrollY)
  await primary.click()

  const dialog = page.getByRole('dialog', { name: 'SwitchesDB · X Green' })
  await dialog.waitFor()
  assert.equal(await dialog.getAttribute('aria-modal'), 'true')
  assert.equal(await dialog.locator('iframe').getAttribute('src'), 'https://switchesdb.switchbook.app/#X%20Green~TG.csv')
  assert.equal(await page.getByRole('button', { name: 'Close SwitchesDB preview for X Green' }).evaluate(element => document.activeElement === element), true)
  assert.ok((await primary.boundingBox())!.height >= 44)
  assert.ok((await page.getByRole('button', { name: 'Close SwitchesDB preview for X Green' }).boundingBox())!.height >= 44)
  const dialogBox = await dialog.boundingBox()
  assert.ok(dialogBox && dialogBox.width <= 390 && dialogBox.height <= 844)

  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached' })
  await page.waitForFunction(() => document.activeElement?.textContent?.trim() === 'View exact curve in SwitchesDB')
  assert.equal(await primary.evaluate(element => document.activeElement === element), true)
  assert.equal(await page.getByLabel('Selected master').inputValue(), 'master-preserved')
  assert.equal(await page.getByLabel('Override reason').inputValue(), 'preserve this override reason')
  assert.equal(await page.getByLabel('Staged action').textContent(), 'ATTACH_SUGGESTION')
  assert.equal(await page.evaluate(() => window.scrollY), scrollBefore)

  await page.getByRole('button', { name: 'View actuation curve in SwitchesDB' }).click()
  const variantFrame = page.getByTitle('SwitchesDB exact force curve for Variant 51000 Actuations')
  assert.equal(await variantFrame.getAttribute('src'), 'https://switchesdb.switchbook.app/#Variant%2051000%20Actuations~TG.csv')
  assert.deepEqual(requests.filter(method => ['PUT', 'PATCH', 'POST', 'DELETE'].includes(method)), [])
})
