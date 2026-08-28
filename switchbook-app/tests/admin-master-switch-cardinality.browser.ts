import assert from 'node:assert/strict'
import test from 'node:test'
import { chromium, type Page, type Response } from 'playwright-core'

const baseUrl = process.env.BROWSER_BASE_URL
const username = process.env.BROWSER_ADMIN_USERNAME
const password = process.env.BROWSER_ADMIN_PASSWORD
const executablePath = process.env.BROWSER_CHROMIUM_PATH

type Counts = { session: number; submissions: number; edits: number }

function classify(response: Response, counts: Counts) {
  const url = new URL(response.url())
  if (url.pathname === '/api/auth/session') counts.session++
  if (url.pathname === '/api/admin/master-switches') counts.submissions++
  if (url.pathname === '/api/admin/master-switch-edits') counts.edits++
}

async function waitForDataPair(page: Page, action: () => Promise<unknown>) {
  await Promise.all([
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/master-switches'),
    page.waitForResponse(response => new URL(response.url()).pathname === '/api/admin/master-switch-edits'),
    action(),
  ])
  await page.waitForTimeout(100)
}

test('production browser resolves one session per full navigation and none per filter change', async t => {
  assert.ok(baseUrl, 'BROWSER_BASE_URL is required')
  assert.ok(username, 'BROWSER_ADMIN_USERNAME is required')
  assert.ok(password, 'BROWSER_ADMIN_PASSWORD is required')

  const browser = await chromium.launch({ executablePath, headless: true })
  t.after(() => browser.close())
  const page = await browser.newPage()

  const publicResponse = await page.goto(`${baseUrl}/`)
  assert.equal(publicResponse?.status(), 200)
  await page.goto(`${baseUrl}/admin`)
  assert.match(page.url(), /\/auth\/login/)

  await page.goto(`${baseUrl}/auth/login`)
  await page.locator('input[name="username"]').fill(username)
  await page.locator('input[name="password"]').fill(password)
  await Promise.all([
    page.waitForURL('**/dashboard'),
    page.locator('button[type="submit"]').click(),
  ])
  assert.match(page.url(), /\/dashboard$/)
  assert.equal((await page.request.get(`${baseUrl}/api/admin/master-switches?status=pending`)).status(), 200)

  const traces: Counts[] = []
  for (let navigation = 0; navigation < 9; navigation++) {
    const counts: Counts = { session: 0, submissions: 0, edits: 0 }
    const listener = (response: Response) => classify(response, counts)
    page.on('response', listener)
    await waitForDataPair(page, () => page.goto(`${baseUrl}/admin/master-switches`))
    page.off('response', listener)
    traces.push(counts)
    assert.deepEqual(counts, { session: 1, submissions: 1, edits: 1 }, `navigation ${navigation + 1}`)
  }

  const filterCounts: Counts = { session: 0, submissions: 0, edits: 0 }
  const filterListener = (response: Response) => classify(response, filterCounts)
  page.on('response', filterListener)
  await waitForDataPair(page, () => page.getByRole('button', { name: 'Approved', exact: true }).click())
  page.off('response', filterListener)
  assert.deepEqual(filterCounts, { session: 0, submissions: 1, edits: 1 })

  t.diagnostic(JSON.stringify({ navigations: traces, filterChange: filterCounts }))
})
