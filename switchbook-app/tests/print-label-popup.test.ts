import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

test('print label popup can distinguish a blocked popup without retaining its opener', () => {
  const source = readFileSync(
    new URL('../src/components/PrintLabelButton.tsx', import.meta.url),
    'utf8'
  )

  assert.match(source, /window\.open\(\s*''[\s\S]*'width=520,height=760'/)
  assert.match(source, /if \(!win\) \{\s*setBlocked\(true\)\s*return\s*\}/)
  assert.match(source, /win\.opener = null\s*win\.location\.replace\(`\/api\/switches\/\$\{switchId\}\/label`\)/)
  assert.match(source, /setBlocked\(false\)/)
})
