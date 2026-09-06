import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync } from 'node:fs'
import { build } from 'esbuild'
import { chromium } from 'playwright-core'

const cachedChromium = `${process.env.HOME}/Library/Caches/ms-playwright/chromium_headless_shell-1161/chrome-mac/headless_shell`
const executablePath = process.env.BROWSER_CHROMIUM_PATH || (existsSync(cachedChromium) ? cachedChromium : undefined)
const mutating = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

async function browserBundle(contents: string) {
  const result = await build({
    stdin: { loader: 'tsx', resolveDir: process.cwd(), contents },
    bundle: true,
    format: 'iife',
    platform: 'browser',
    jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"test"' },
    write: false,
  })
  return result.outputFiles[0].text
}

const shell = `<!doctype html><html><head><style>
  body{margin:0}.fixed{position:fixed}.inset-0{inset:0}.flex{display:flex}.flex-col{flex-direction:column}
  .flex-1{flex:1}.items-center{align-items:center}.justify-center{justify-content:center}.w-full{width:100%}
  .h-full{height:100%}.h\\-\\[calc\\(100dvh-1rem\\)\\]{height:calc(100dvh - 1rem)}
</style></head><body><div id="root"></div></body></html>`

test('deployed admin review overlay and GitHub provenance remain available together', async t => {
  const bundle = await browserBundle(`
    import React from 'react'
    import { createRoot } from 'react-dom/client'
    import ForceCurveReviewQueue from './src/components/admin/ForceCurveReviewQueue'
    const candidate = {
      id:'c1', source:'github:ThereminGoat/force-curves', displayName:'Exact Stock',
      repositoryPath:'Exact Stock/Exact Stock Raw Data CSV.csv', revision:'rev', contentHash:'sha',
      manufacturer:'Exact', technology:'MECHANICAL', switchesDBExact:'verified'
    }
    const evidence = { id:'r1', kind:'SOURCE_UNVERIFIED', reason:'review', status:'OPEN', catalogEntryId:'c1', masterSwitch:null, candidates:[candidate] }
    const item = { sourceKey:'measurement:exact-stock', primaryReviewId:'r1', bucket:'ACTIONABLE', confidence:1, actionable:true, deferred:false, status:'OPEN', evidence:[evidence] }
    const queue = { items:[item], counts:{ACTIONABLE:1}, rawReviewCount:1, uniqueSourceCount:1, openSourceCount:1, resolvedSourceCount:0, remainingActionable:1, deferredCount:0, filteredSourceCount:1, pagination:{page:1,pageSize:50,pageCount:1,hasPrevious:false,hasNext:false} }
    createRoot(document.getElementById('root')).render(<ForceCurveReviewQueue initialQueue={queue} rankAssistEnabled={false} />)
  `)
  const browser = await chromium.launch({ executablePath, headless: true })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const requests: { method: string; url: string }[] = []
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }))
  await page.route('https://switchesdb.switchbook.app/**', route => route.fulfill({ contentType:'text/html', body:`<button>Admin iframe control</button><script>addEventListener('keydown',event=>{if(event.key==='Escape')parent.postMessage('switchbook:switchesdb:escape','*')})</script>` }))
  await page.setContent(shell)
  await page.addScriptTag({ content: bundle })

  const github = page.getByRole('link', { name:'Open ThereminGoat force curve source file for Exact Stock in a new tab' })
  assert.equal(await github.getAttribute('href'), 'https://github.com/ThereminGoat/force-curves/blob/main/Exact%20Stock/Exact%20Stock%20Raw%20Data%20CSV.csv')
  assert.equal(await github.getAttribute('target'), '_blank')
  assert.equal(await github.getAttribute('rel'), 'noopener noreferrer')

  const trigger = page.getByRole('button', { name:'View exact curve in SwitchesDB' })
  await trigger.click()
  const dialog = page.getByRole('dialog', { name:'SwitchesDB · Exact Stock' })
  await dialog.waitFor()
  assert.equal(await dialog.locator('iframe').getAttribute('src'), 'https://switchesdb.switchbook.app/#Exact%20Stock~TG.csv')
  assert.match((await dialog.textContent()) || '', /does not change the review queue/)
  await dialog.locator('iframe').contentFrame().getByRole('button', { name:'Admin iframe control' }).focus()
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state:'detached' })
  assert.equal(await trigger.evaluate(element => document.activeElement === element), true)
  assert.deepEqual(requests.filter(request => mutating.has(request.method)), [])
})

test('Collections and Master Database one/multi controls open exact GET-only overlays and preserve state', async t => {
  const bundle = await browserBundle(`
    import React, { useState } from 'react'
    import { createRoot } from 'react-dom/client'
    import ForceCurvesButton from './src/components/ForceCurvesButton'
    function Harness() {
      const [collectionNote, setCollectionNote] = useState('collection draft')
      const [masterFilter, setMasterFilter] = useState('linear')
      const showForceCurves = true
      const disabledFlag = false
      return <main>
        <div style={{height:360}}>top spacer</div>
        <label>Collection note<input aria-label="Collection note" value={collectionNote} onChange={event=>setCollectionNote(event.target.value)} /></label>
        <section aria-label="Collections controls">
          {showForceCurves && <ForceCurvesButton masterSwitchId="collection-one" switchName="Collections One" manufacturer="Exact" forceCurvesCached isAuthenticated />}
          {showForceCurves && <ForceCurvesButton masterSwitchId="collection-multi" switchName="Collections Multi" manufacturer="Exact" forceCurvesCached isAuthenticated={false} />}
          {disabledFlag && <ForceCurvesButton masterSwitchId="flag-disabled" switchName="Flag Disabled" forceCurvesCached />}
        </section>
        <label>Master filter<input aria-label="Master filter" value={masterFilter} onChange={event=>setMasterFilter(event.target.value)} /></label>
        <section aria-label="Master Database controls">
          <ForceCurvesButton masterSwitchId="master-one" switchName="Master One" manufacturer="Exact" forceCurvesCached isAuthenticated={false} />
          <ForceCurvesButton masterSwitchId="master-multi" switchName="Master Multi" manufacturer="Exact" forceCurvesCached isAuthenticated />
        </section>
        <div style={{height:700}}>bottom spacer</div>
      </main>
    }
    createRoot(document.getElementById('root')).render(<Harness />)
  `)
  const fixtures: Record<string, unknown[]> = {
    'collection-one': [
      { id:'collection-stock', measurementId:'github:ThereminGoat/force-curves:Collection One Stock/Collection One Stock Raw Data CSV.csv', folderName:'Collection One Stock', url:'https://switchesdb.switchbook.app/#Collection%20One%20Stock~TG.csv', sourceUrl:'https://github.com/ThereminGoat/force-curves/blob/main/Collection%20One%20Stock/Collection%20One%20Stock%20Raw%20Data%20CSV.csv', provenance:'ThereminGoat', condition:'Stock', measurementDate:null },
    ],
    'collection-multi': [
      { id:'collection-multi-stock', measurementId:'github:ThereminGoat/force-curves:Collection Multi/Collection Multi Stock Raw Data CSV.csv', folderName:'Collection Multi Stock', url:'https://switchesdb.switchbook.app/#Collection%20Multi%20Stock~TG.csv', sourceUrl:'https://github.com/ThereminGoat/force-curves/blob/main/Collection%20Multi/stock.csv', provenance:'ThereminGoat', condition:'Stock', measurementDate:'2026-08-01' },
      { id:'collection-multi-retest', measurementId:'github:ThereminGoat/force-curves:Collection Multi/Collection Multi 51000 Actuations Raw Data CSV.csv', folderName:'Collection Multi 51000 Actuations', url:'https://switchesdb.switchbook.app/#Collection%20Multi%2051000%20Actuations~TG.csv', sourceUrl:'https://github.com/ThereminGoat/force-curves/blob/main/Collection%20Multi/retest.csv', provenance:'ThereminGoat', condition:'Break-in / retest', measurementDate:'2026-08-29' },
    ],
    'master-one': [
      { id:'master-stock', measurementId:'github:ThereminGoat/force-curves:Master One/Master One Stock Raw Data CSV.csv', folderName:'Master One Stock', url:'https://switchesdb.switchbook.app/#Master%20One%20Stock~TG.csv', sourceUrl:'https://github.com/ThereminGoat/force-curves/blob/main/Master%20One/stock.csv', provenance:'ThereminGoat', condition:'Stock', measurementDate:null },
    ],
    'master-multi': [
      { id:'master-multi-stock', measurementId:'github:ThereminGoat/force-curves:Master Multi/Master Multi Stock Raw Data CSV.csv', folderName:'Master Multi Stock', url:'https://switchesdb.switchbook.app/#Master%20Multi%20Stock~TG.csv', sourceUrl:'https://github.com/ThereminGoat/force-curves/blob/main/Master%20Multi/stock.csv', provenance:'ThereminGoat', condition:'Stock', measurementDate:'2026-07-01' },
      { id:'master-multi-retest', measurementId:'github:ThereminGoat/force-curves:Master Multi/Master Multi Retest Raw Data CSV.csv', folderName:'Master Multi Retest', url:'https://switchesdb.switchbook.app/#Master%20Multi%20Retest~TG.csv', sourceUrl:'https://github.com/ThereminGoat/force-curves/blob/main/Master%20Multi/retest.csv', provenance:'ThereminGoat', condition:'Break-in / retest', measurementDate:'2026-09-01' },
    ],
  }
  const browser = await chromium.launch({ executablePath, headless: true })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, colorScheme:'dark' })
  const requests: { method: string; url: string }[] = []
  page.on('request', request => requests.push({ method:request.method(), url:request.url() }))
  await page.route('http://switchbook.test/**', route => {
    const url = new URL(route.request().url())
    const id = url.pathname.match(/^\/api\/force-curves\/(.+)$/)?.[1]
    if (id && fixtures[id]) return route.fulfill({ contentType:'application/json', body:JSON.stringify({ source:'canonical-exact', curves:fixtures[id] }) })
    return route.fulfill({ contentType:'text/html', body:shell })
  })
  await page.route('https://switchesdb.switchbook.app/**', route => route.fulfill({ contentType:'text/html', body:`<button>Iframe control</button><script>addEventListener('keydown',event=>{if(event.key==='Escape')parent.postMessage('switchbook:switchesdb:escape','*')})</script>` }))
  await page.goto('http://switchbook.test/?view=cards')
  await page.addScriptTag({ content:bundle })
  await page.getByRole('button', { name:'View force curves for Collections One' }).waitFor()
  assert.equal(await page.getByRole('button', { name:'View force curves for Flag Disabled' }).count(), 0)
  await page.getByLabel('Collection note').fill('preserved collection draft')
  await page.getByLabel('Master filter').fill('preserved master filter')
  await page.evaluate(() => window.scrollTo(0, 300))
  const scrollBefore = await page.evaluate(() => window.scrollY)

  const collectionOne = page.getByRole('button', { name:'View force curves for Collections One' })
  await collectionOne.click()
  const collectionOneDialog = page.getByRole('dialog', { name:/SwitchesDB · Collection One Stock/ })
  assert.equal(await page.getByRole('dialog', { name:'Choose a force curve for Collections One' }).count(), 0)
  assert.equal(await collectionOneDialog.locator('iframe').getAttribute('src'), 'https://switchesdb.switchbook.app/#Collection%20One%20Stock~TG.csv')
  const source = collectionOneDialog.getByRole('link', { name:/Open exact GitHub source/ })
  assert.equal(await source.getAttribute('target'), '_blank')
  assert.match((await source.getAttribute('href')) || '', /^https:\/\/github\.com\/ThereminGoat\/force-curves\/blob\/main\//)
  const box = await collectionOneDialog.boundingBox()
  assert.ok(box && box.width <= 390 && box.height <= 844)
  await collectionOneDialog.locator('iframe').contentFrame().getByRole('button', { name:'Iframe control' }).focus()
  await page.keyboard.press('Escape')
  await collectionOneDialog.waitFor({ state:'detached' })
  await page.waitForFunction(element => document.activeElement === element, await collectionOne.elementHandle())

  const collectionMulti = page.getByRole('button', { name:'View force curves for Collections Multi' })
  await collectionMulti.click()
  const collectionPicker = page.getByRole('dialog', { name:'Choose a force curve for Collections Multi' })
  assert.match((await collectionPicker.textContent()) || '', /ThereminGoat · Stock · 8\/1\/2026/)
  assert.match((await collectionPicker.textContent()) || '', /ThereminGoat · Break-in \/ retest · 8\/29\/2026/)
  await collectionPicker.getByRole('button', { name:/Collection Multi 51000 Actuations/ }).click()
  const collectionMultiDialog = page.getByRole('dialog', { name:/SwitchesDB · Collection Multi 51000 Actuations/ })
  assert.equal(await collectionMultiDialog.locator('iframe').getAttribute('src'), 'https://switchesdb.switchbook.app/#Collection%20Multi%2051000%20Actuations~TG.csv')
  await collectionMultiDialog.getByRole('button', { name:/Close SwitchesDB preview/ }).click()

  const masterOne = page.getByRole('button', { name:'View force curves for Master One' })
  await masterOne.click()
  const masterOneDialog = page.getByRole('dialog', { name:/SwitchesDB · Master One Stock/ })
  assert.equal(await page.getByRole('dialog', { name:'Choose a force curve for Master One' }).count(), 0)
  assert.equal(await masterOneDialog.locator('iframe').getAttribute('src'), 'https://switchesdb.switchbook.app/#Master%20One%20Stock~TG.csv')
  await masterOneDialog.getByRole('button', { name:/Close SwitchesDB preview/ }).click()

  const masterMulti = page.getByRole('button', { name:'View force curves for Master Multi' })
  await masterMulti.click()
  const masterPicker = page.getByRole('dialog', { name:'Choose a force curve for Master Multi' })
  assert.match((await masterPicker.textContent()) || '', /ThereminGoat · Stock · 7\/1\/2026/)
  assert.match((await masterPicker.textContent()) || '', /ThereminGoat · Break-in \/ retest · 9\/1\/2026/)
  await masterPicker.getByRole('button', { name:/Master Multi Retest/ }).click()
  const masterMultiDialog = page.getByRole('dialog', { name:/SwitchesDB · Master Multi Retest/ })
  assert.equal(await masterMultiDialog.locator('iframe').getAttribute('src'), 'https://switchesdb.switchbook.app/#Master%20Multi%20Retest~TG.csv')
  await masterMultiDialog.getByRole('button', { name:/Close SwitchesDB preview/ }).click()

  assert.equal(await page.getByLabel('Collection note').inputValue(), 'preserved collection draft')
  assert.equal(await page.getByLabel('Master filter').inputValue(), 'preserved master filter')
  assert.equal(await page.evaluate(() => location.search), '?view=cards')
  assert.equal(await page.evaluate(() => window.scrollY), scrollBefore)
  assert.deepEqual(requests.filter(request => mutating.has(request.method)), [])
  assert.equal(requests.filter(request => request.url.includes('/api/force-curves/')).every(request => request.method === 'GET'), true)
})
