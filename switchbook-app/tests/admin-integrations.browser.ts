import assert from 'node:assert/strict'
import test from 'node:test'
import { chromium } from 'playwright-core'

const baseUrl = process.env.BROWSER_BASE_URL
const username = process.env.BROWSER_ADMIN_USERNAME
const password = process.env.BROWSER_ADMIN_PASSWORD
const executablePath = process.env.BROWSER_CHROMIUM_PATH

test('authenticated admin integration UI is responsive and metadata-only', async t => {
  assert.ok(baseUrl && username && password, 'browser URL and ADMIN credentials are required')
  const browser = await chromium.launch({ executablePath, headless: true })
  t.after(() => browser.close())
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  await page.goto(`${baseUrl}/auth/login`)
  await page.locator('input[name="username"]').fill(username)
  await page.locator('input[name="password"]').fill(password)
  await Promise.all([page.waitForURL('**/dashboard'), page.locator('button[type="submit"]').click()])
  await page.goto(`${baseUrl}/admin/integrations`)
  await page.getByRole('heading', { name: 'Integration API keys' }).waitFor()
  await page.getByRole('button', { name: 'Create and reveal key' }).waitFor()
  assert.equal(await page.locator('body').evaluate(node => node.scrollWidth <= window.innerWidth), true)

  const response = await page.request.get(`${baseUrl}/api/admin/integrations`)
  assert.equal(response.status(), 200)
  assert.match(response.headers()['cache-control'] || '', /no-store/)
  const body = await response.text()
  assert.doesNotMatch(body, /secretHash|webhookSecretEnvelope|"apiKey"/)
})

test('anonymous admin integration API is rejected', async t => {
  assert.ok(baseUrl, 'browser URL is required')
  const browser = await chromium.launch({ executablePath, headless: true })
  t.after(() => browser.close())
  const request = await browser.newPage()
  const response = await request.request.get(`${baseUrl}/api/admin/integrations`)
  assert.equal(response.status(), 401)
  assert.match(response.headers()['cache-control'] || '', /no-store/)
})
