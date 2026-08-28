import assert from 'node:assert/strict'
import test from 'node:test'
import { chromium } from 'playwright-core'

const baseUrl = process.env.BROWSER_BASE_URL
const username = process.env.BROWSER_ADMIN_USERNAME
const password = process.env.BROWSER_ADMIN_PASSWORD
const executablePath = process.env.BROWSER_CHROMIUM_PATH

function p95(samples: number[]) {
  return [...samples].sort((a, b) => a - b)[Math.ceil(samples.length * 0.95) - 1]
}

test('production browser keeps the production-cardinality force curve route and API bounded', async t => {
  assert.ok(baseUrl && username && password, 'browser URL and ADMIN credentials are required')
  const browser = await chromium.launch({ executablePath, headless: true })
  t.after(() => browser.close())
  const page = await browser.newPage()
  await page.goto(`${baseUrl}/auth/login`)
  await page.locator('input[name="username"]').fill(username)
  await page.locator('input[name="password"]').fill(password)
  await Promise.all([page.waitForURL('**/dashboard'), page.locator('button[type="submit"]').click()])

  const routeMs: number[] = []
  for (let i = 0; i < 9; i++) {
    await page.goto(`${baseUrl}/admin/force-curves`)
    const duration = await page.evaluate(() => performance.getEntriesByType('navigation').at(-1)?.duration || 0)
    if (i) routeMs.push(duration)
    assert.equal(await page.locator('article').count(), 50)
  }

  const apiMs: number[] = []
  let bytes = 0
  for (let i = 0; i < 9; i++) {
    const result = await page.evaluate(async () => {
      const started = performance.now()
      const response = await fetch('/api/admin/force-curves/reviews?page=1&pageSize=50&bucket=ALL&status=OPEN', { cache: 'no-store' })
      const text = await response.text()
      return { status: response.status, duration: performance.now() - started, text }
    })
    assert.equal(result.status, 200)
    const queue = JSON.parse(result.text)
    assert.deepEqual([queue.rawReviewCount, queue.uniqueSourceCount, queue.openSourceCount, queue.filteredSourceCount, queue.items.length, queue.pagination.pageCount], [10512, 5484, 2725, 2725, 50, 55])
    bytes = Buffer.byteLength(result.text)
    assert.ok(bytes < 200_000)
    if (i) apiMs.push(result.duration)
  }

  assert.ok(p95(routeMs) < 1000, `warm route p95 ${p95(routeMs)}ms`)
  assert.ok(p95(apiMs) < 750, `warm API p95 ${p95(apiMs)}ms`)
  t.diagnostic(JSON.stringify({ routeMs, routeP95Ms: p95(routeMs), apiMs, apiP95Ms: p95(apiMs), bytes }))
})
