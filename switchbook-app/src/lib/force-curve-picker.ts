export type PickerRect = { left: number; right: number; top: number; bottom: number }

export function forceCurvePickerPosition(rect: PickerRect, viewportWidth: number, viewportHeight: number) {
  const gutter = 16
  const gap = 4
  const width = Math.max(0, Math.min(320, viewportWidth - gutter * 2))
  const estimatedHeight = Math.min(288, Math.max(0, viewportHeight - gutter * 2))
  const left = Math.min(Math.max(gutter, rect.left), Math.max(gutter, viewportWidth - width - gutter))
  const fitsBelow = rect.bottom + gap + estimatedHeight <= viewportHeight - gutter
  const top = fitsBelow
    ? rect.bottom + gap
    : Math.max(gutter, Math.min(rect.top - gap - estimatedHeight, viewportHeight - estimatedHeight - gutter))
  return { position: 'fixed' as const, left, top, width, maxHeight: estimatedHeight, zIndex: 9999 }
}
