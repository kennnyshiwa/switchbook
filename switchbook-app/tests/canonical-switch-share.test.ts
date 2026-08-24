import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import CanonicalSwitchShare, { CanonicalShareImage } from '../src/components/CanonicalSwitchShare'
import { serializeCanonicalSwitchShare } from '../src/lib/canonical-switch-share'

const complete = {
  name: 'Jade', chineseName: '玉', manufacturer: 'Acme', type: 'TACTILE', technology: 'MAGNETIC',
  compatibility: 'MX', clickType: 'CLICK_JACKET', topHousing: 'PC', bottomHousing: 'Nylon', stem: 'POM',
  topHousingColor: 'Clear', bottomHousingColor: 'Purple', stemColor: 'Green', stemShape: 'Box', markings: 'AC',
  springWeight: '62', springLength: '20', doubleStage: true, progressiveSpring: true, initialForce: 30,
  actuationForce: 42, tactileForce: 50, bottomOutForce: 62, preTravel: 1.8, tactilePosition: 1.6, bottomOut: 3.5,
  magnetOrientation: 'North', magnetPosition: 'Centered', magnetPolarity: 'N', pcbThickness: '1.6mm',
  initialMagneticFlux: 35, bottomOutMagneticFlux: 700, frankenTop: 'Other top', frankenBottom: 'Other bottom',
  frankenStem: 'Other stem', notes: 'Canonical notes', primaryImageId: 'two', imageUrl: 'https://example.com/legacy.png',
  images: [{ id: 'one', url: 'https://example.com/one.png' }, { id: 'two', url: 'https://example.com/two.png' }],
}

test('full master and user records have identical canonical sections, labels, values, and image ordering', () => {
  const master = serializeCanonicalSwitchShare('master', { ...complete, submittedBy: { username: 'maker' } })
  const user = serializeCanonicalSwitchShare('user', { ...complete, masterSwitchId: 'linked', user: { username: 'owner' } })
  assert.deepEqual(user.sections, master.sections)
  assert.deepEqual(user.images, master.images)
  assert.equal(master.images[0].url, 'https://example.com/two.png')
  const keys = master.sections.flatMap(section => section.stats.map(stat => stat.key))
  for (const key of ['topHousingColor', 'bottomHousingColor', 'stemColor', 'markings', 'stemShape', 'compatibility', 'doubleStage', 'progressiveSpring', 'initialMagneticFlux', 'bottomOutMagneticFlux']) assert.ok(keys.includes(key), key)
})

test('sparse records omit unavailable fields consistently and preserve zero values', () => {
  const master = serializeCanonicalSwitchShare('master', { name: 'Sparse', actuationForce: 0 })
  const user = serializeCanonicalSwitchShare('user', { name: 'Sparse', actuationForce: 0 })
  assert.deepEqual(user.sections, master.sections)
  assert.deepEqual(master.sections, [{ title: 'Force', stats: [{ key: 'actuationForce', label: 'Actuation Force', value: '0g' }] }])
})

test('available false booleans render No while unavailable booleans remain omitted', () => {
  const share = serializeCanonicalSwitchShare('user', { name: 'Boolean', doubleStage: false, progressiveSpring: true, isModified: false })
  assert.deepEqual(share.sections.find(section => section.title === 'Spring')?.stats, [
    { key: 'doubleStage', label: 'Double-stage Spring', value: 'No' },
    { key: 'progressiveSpring', label: 'Progressive Spring', value: 'Yes' },
  ])
  assert.deepEqual(share.personalSections[0].stats, [{ key: 'isModified', label: 'Modified', value: 'No' }])
  const unavailable = serializeCanonicalSwitchShare('user', { name: 'Unavailable' })
  assert.equal(unavailable.sections.some(section => section.title === 'Spring'), false)
  assert.equal(unavailable.personalSections.length, 0)
})

test('purple M badge is based only on source kind, never a user link', () => {
  const master = serializeCanonicalSwitchShare('master', complete)
  const linkedUser = serializeCanonicalSwitchShare('user', { ...complete, masterSwitchId: 'master-id' })
  assert.match(renderToStaticMarkup(React.createElement(CanonicalSwitchShare, { share: master })), /data-testid="master-badge"/)
  assert.doesNotMatch(renderToStaticMarkup(React.createElement(CanonicalSwitchShare, { share: linkedUser })), /data-testid="master-badge"/)
})

test('image and same-size fallback are both rendered by the shared image presenter', () => {
  const full = serializeCanonicalSwitchShare('master', complete)
  const sparse = serializeCanonicalSwitchShare('master', { name: 'Sparse' })
  assert.match(renderToStaticMarkup(React.createElement(CanonicalShareImage, { share: full })), /data-testid="share-image"/)
  const fallback = renderToStaticMarkup(React.createElement(CanonicalShareImage, { share: sparse }))
  assert.match(fallback, /data-testid="share-image-fallback"/)
  assert.match(fallback, /h-96/)
})
