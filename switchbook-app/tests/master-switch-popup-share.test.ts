import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MasterSwitchDetailsPopup from '../src/components/MasterSwitchDetailsPopup'
import MasterSwitchShareButton, { getMasterSwitchShareUrl } from '../src/components/MasterSwitchShareButton'

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

test('popup places Copy Share Link immediately after View Full Details', () => {
  const markup = renderPopup('share-123')
  assert.match(markup, />View Full Details<\/a><button[^>]*aria-label="Copy share link"[^>]*>/)
  assert.match(markup, />Copy Share Link<\/span>/)
  assert.match(markup, />Suggest Edit<\/a>/)
})

test('share button is omitted gracefully when a master switch has no shareable ID', () => {
  const popupMarkup = renderPopup(null)
  assert.match(popupMarkup, />View Full Details<\/a>/)
  assert.doesNotMatch(popupMarkup, /Copy Share Link/)

  const buttonMarkup = renderToStaticMarkup(
    React.createElement(MasterSwitchShareButton, { shareableId: undefined })
  )
  assert.equal(buttonMarkup, '')
})
