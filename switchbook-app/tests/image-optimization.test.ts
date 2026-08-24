import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { bypassImageOptimizer } from '../src/lib/image-optimization'

test('external linked gallery images bypass Next optimization while owned uploads remain optimized', () => {
  assert.equal(bypassImageOptimizer('LINKED'), true)
  assert.equal(bypassImageOptimizer('UPLOADED'), false)

  const gallery = readFileSync(new URL('../src/components/ImageGallery.tsx', import.meta.url), 'utf8')
  assert.match(gallery, /unoptimized=\{bypassImageOptimizer\(currentImage\.type\)\}/)
  assert.match(gallery, /unoptimized=\{bypassImageOptimizer\(image\.type\)\}/)
  assert.doesNotMatch(gallery, /unoptimized(?:\s|=)+(?:true|\{true\})/)
})
