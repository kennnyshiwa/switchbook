import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MasterSwitchDetailsPopup from '../src/components/MasterSwitchDetailsPopup'
import MasterSwitchShareButton, { getMasterSwitchShareUrl } from '../src/components/MasterSwitchShareButton'
import SwitchShareButton, { SHARE_ICON_PATH } from '../src/components/SwitchShareButton'

const noop = () => {}

function renderPopup(shareableId?: string | null) {
  return renderToStaticMarkup(React.createElement(MasterSwitchDetailsPopup, {
    switchItem: {
      id: 'master-1',
      shareableId,
      name: 'Jade',
      inCollection: true,
      inWishlist: false,
      userCount: 2,
      submittedBy: { id: 'user-1', username: 'maker' },
    },
    onClose: noop,
    onAddToCollection: noop,
    onAddToWishlist: noop,
    onOpenLinkDialog: noop,
    isAddingSwitch: false,
    isAddingToWishlist: false,
    isDeletingSwitch: false,
  }))
}

test('master switch share URL uses the canonical public route', () => {
  assert.equal(
    getMasterSwitchShareUrl('share-123', 'https://switchbook.example'),
    'https://switchbook.example/share/switch/share-123'
  )
})

test('popup places an icon-only copy action in the header and never in the footer', () => {
  const markup = renderPopup('share-123')
  const header = markup.slice(markup.indexOf('data-testid="master-switch-popup-header"'), markup.indexOf('data-testid="master-switch-popup-footer"'))
  const footer = markup.slice(markup.indexOf('data-testid="master-switch-popup-footer"'))

  assert.match(header, /<button[^>]*aria-label="Copy share link"[^>]*title="Copy share link"[^>]*data-share-state="idle"[^>]*><svg/)
  assert.doesNotMatch(header, /Copy Share Link<\/span>/)
  assert.doesNotMatch(footer, /aria-label="Copy share link"|data-share-state=/)
  assert.match(footer, />View Full Details<\/a>/)
  assert.match(markup, />Suggest Edit<\/a>/)
})

test('master action reuses the personal card share icon path', () => {
  const masterMarkup = renderToStaticMarkup(
    React.createElement(MasterSwitchShareButton, { shareableId: 'share-123' })
  )
  const personalMarkup = renderToStaticMarkup(
    React.createElement(SwitchShareButton, { switchId: 'switch-1', shareableId: 'personal-123', iconOnly: true })
  )

  assert.match(masterMarkup, new RegExp(`d="${SHARE_ICON_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
  assert.match(personalMarkup, new RegExp(`d="${SHARE_ICON_PATH.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`))
})

test('share button is omitted gracefully when a master switch has no shareable ID', () => {
  const popupMarkup = renderPopup(null)
  assert.match(popupMarkup, />View Full Details<\/a>/)
  assert.doesNotMatch(popupMarkup, /aria-label="Copy share link"|data-share-state=/)

  const buttonMarkup = renderToStaticMarkup(
    React.createElement(MasterSwitchShareButton, { shareableId: undefined })
  )
  assert.equal(buttonMarkup, '')
})
