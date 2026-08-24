import assert from 'node:assert/strict'
import test from 'node:test'
import { issuePartnerKey, secureEqualHash } from '../src/lib/partner-api/crypto'
import { proposedSwitchSchema } from '../src/lib/partner-api/schemas'
import { validateImageUrl } from '../src/lib/image-security'
import { switchesDbSearchUrl } from '../src/lib/partner-api/config'

test('partner keys are prefixed, random, and hash-verifiable', () => {
  const first = issuePartnerKey()
  const second = issuePartnerKey()
  assert.match(first.raw, /^sbk_[a-f0-9]{12}\.[A-Za-z0-9_-]+$/)
  assert.notEqual(first.raw, second.raw)
  assert.equal(secureEqualHash(first.raw, first.hash), true)
  assert.equal(secureEqualHash(`${first.raw}x`, first.hash), false)
})

test('proposal schema bounds input and requires photo alt text', () => {
  assert.equal(proposedSwitchSchema.safeParse({ name: 'Oil King', manufacturer: 'Gateron', submissionNotes: 'A complete source note', photos: [] }).success, true)
  assert.equal(proposedSwitchSchema.safeParse({ name: '', manufacturer: 'Gateron', submissionNotes: 'short' }).success, false)
  assert.equal(proposedSwitchSchema.safeParse({ name: 'X', manufacturer: 'Y', submissionNotes: 'A complete source note', photos: [{ url: 'https://example.com/x.png', alt: '' }] }).success, false)
})

test('image URL validation blocks local and insecure sources', () => {
  assert.equal(validateImageUrl('http://example.com/image.png').valid, false)
  assert.equal(validateImageUrl('https://127.0.0.1/image.png').valid, false)
  assert.equal(validateImageUrl('https://169.254.169.254/latest.png').valid, false)
  assert.equal(validateImageUrl('https://images.example.com/image.png').valid, true)
})

test('SwitchesDB links carry encoded manufacturer and model search', () => {
  assert.equal(switchesDbSearchUrl('Oil King', 'Gateron'), 'https://switchesdb.switchbook.app/?search=Gateron%20Oil%20King')
})
