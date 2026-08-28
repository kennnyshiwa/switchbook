import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('admin dashboard exposes an accessible force curve review control', () => {
  const source = readFileSync(new URL('../src/app/admin/page.tsx', import.meta.url), 'utf8')

  assert.match(source, /href="\/admin\/force-curves"/)
  assert.match(source, />Force Curve Review Queue<\/h3>/)
  assert.match(source, /focus-visible:ring-2/)
  assert.match(source, /dark:bg-gray-800/)
  assert.match(source, /dark:text-white/)
})
