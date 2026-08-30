export const VIRTUAL_SWITCH_LIST_GAP = 16
export const VIRTUAL_SWITCH_LIST_ROW_PADDING = 24

export function getVirtualSwitchCardWidth(containerWidth: number, columnCount: number): number {
  if (containerWidth <= 0 || columnCount <= 0) return 0

  const contentWidth = Math.max(0, containerWidth - VIRTUAL_SWITCH_LIST_ROW_PADDING * 2)
  return Math.max(0, (contentWidth - VIRTUAL_SWITCH_LIST_GAP * (columnCount - 1)) / columnCount)
}

export function getVirtualSwitchRowHeight(imageHeight: number, textHeight: number): number {
  return (
    imageHeight
    + textHeight
    + VIRTUAL_SWITCH_LIST_GAP
    + VIRTUAL_SWITCH_LIST_ROW_PADDING * 2
  )
}
