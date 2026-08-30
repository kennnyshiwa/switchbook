import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getVirtualSwitchCardWidth,
  getVirtualSwitchRowHeight,
  VIRTUAL_SWITCH_LIST_GAP,
  VIRTUAL_SWITCH_LIST_ROW_PADDING,
} from '../src/lib/virtual-switch-list-geometry'

test('virtual switch card width excludes row padding and inter-card gaps', () => {
  const containerWidth = 1200
  const columns = 5
  const expected = (
    containerWidth
    - VIRTUAL_SWITCH_LIST_ROW_PADDING * 2
    - VIRTUAL_SWITCH_LIST_GAP * (columns - 1)
  ) / columns

  assert.equal(getVirtualSwitchCardWidth(containerWidth, columns), expected)
  assert.equal(
    expected * columns
      + VIRTUAL_SWITCH_LIST_GAP * (columns - 1)
      + VIRTUAL_SWITCH_LIST_ROW_PADDING * 2,
    containerWidth,
  )
})

test('virtual row contains its complete card, badge, padding, and row gap', () => {
  const imageHeight = 217.6
  const textAndBadgeHeight = 76
  const rowHeight = getVirtualSwitchRowHeight(imageHeight, textAndBadgeHeight)

  assert.equal(rowHeight, 357.6)
  assert.equal(
    rowHeight - VIRTUAL_SWITCH_LIST_ROW_PADDING,
    VIRTUAL_SWITCH_LIST_ROW_PADDING + imageHeight + textAndBadgeHeight + VIRTUAL_SWITCH_LIST_GAP,
  )
})

test('invalid geometry inputs fail closed without negative card widths', () => {
  assert.equal(getVirtualSwitchCardWidth(0, 5), 0)
  assert.equal(getVirtualSwitchCardWidth(40, 5), 0)
  assert.equal(getVirtualSwitchCardWidth(1200, 0), 0)
})
