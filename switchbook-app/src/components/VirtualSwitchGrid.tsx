'use client'

import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react'
import { Switch } from '@prisma/client'
import SwitchCard from './SwitchCard'

interface SwitchImage {
  id: string
  url: string
  type: 'UPLOADED' | 'LINKED'
  order: number
  caption?: string | null
  thumbnailUrl?: string
  mediumUrl?: string
}

interface ExtendedSwitch extends Switch {
  images?: SwitchImage[]
}

interface VirtualSwitchGridProps {
  switches: ExtendedSwitch[]
  onDelete: (switchId: string) => void
  onEdit: (switchData: ExtendedSwitch) => void
  showForceCurves: boolean
  forceCurveCache: Map<string, boolean>
  forceCurvePreferencesMap: Map<string, { folder: string; url: string }>
  selectedSwitches: Set<string>
  onSelectionChange: (switchId: string) => void
}

const CARD_GAP = 24        // gap-6
const DEFAULT_ROW_HEIGHT = 520 // generous default until measured

const BREAKPOINTS = {
  base: 1,
  md: { min: 768, cols: 2 },
  lg: { min: 1024, cols: 3 },
}

const MemoizedSwitchCard = memo(SwitchCard)

export default function VirtualSwitchGrid({
  switches,
  onDelete,
  onEdit,
  showForceCurves,
  forceCurveCache,
  forceCurvePreferencesMap,
  selectedSwitches,
  onSelectionChange,
}: VirtualSwitchGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [scrollTop, setScrollTop] = useState(0)
  // Map of rowIndex -> measured height
  const [measuredHeights, setMeasuredHeights] = useState<Map<number, number>>(new Map())
  const rowRefs = useRef<Map<number, HTMLDivElement>>(new Map())

  // ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width, height })
    })
    ro.observe(containerRef.current)
    return () => ro.disconnect()
  }, [])

  // Column count
  const columnCount = useMemo(() => {
    const w = containerSize.width
    if (w >= BREAKPOINTS.lg.min) return BREAKPOINTS.lg.cols
    if (w >= BREAKPOINTS.md.min) return BREAKPOINTS.md.cols
    return BREAKPOINTS.base
  }, [containerSize.width])

  // Split switches into rows
  const rows = useMemo(() => {
    if (!switches.length || !columnCount) return [] as ExtendedSwitch[][]
    const result: ExtendedSwitch[][] = []
    for (let i = 0; i < switches.length; i += columnCount) {
      result.push(switches.slice(i, i + columnCount))
    }
    return result
  }, [switches, columnCount])

  // Reset measurements when switches or columns change
  useEffect(() => {
    setMeasuredHeights(new Map())
    rowRefs.current = new Map()
  }, [switches, columnCount])

  // Get height for a row — measured or default
  const getRowHeight = useCallback((rowIndex: number) => {
    return measuredHeights.get(rowIndex) ?? DEFAULT_ROW_HEIGHT
  }, [measuredHeights])

  // Compute cumulative heights and total
  const { cumulativeHeights, totalHeight } = useMemo(() => {
    const cum: number[] = []
    let total = 0
    for (let i = 0; i < rows.length; i++) {
      cum.push(total)
      total += getRowHeight(i) + CARD_GAP
    }
    return { cumulativeHeights: cum, totalHeight: total }
  }, [rows.length, getRowHeight])

  // Find visible rows
  const { startRow, endRow } = useMemo(() => {
    if (!cumulativeHeights.length || !containerSize.height) return { startRow: 0, endRow: Math.min(rows.length, 3) }

    let start = 0
    while (start < cumulativeHeights.length - 1 &&
           cumulativeHeights[start + 1] < scrollTop) {
      start++
    }
    start = Math.max(0, start - 1)

    let end = start
    const limit = scrollTop + containerSize.height + containerSize.height * 0.5
    while (end < cumulativeHeights.length && cumulativeHeights[end] < limit) {
      end++
    }
    end = Math.min(rows.length, end + 1)

    return { startRow: start, endRow: end }
  }, [scrollTop, containerSize.height, cumulativeHeights, rows.length])

  // Measure rendered rows after paint
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      let changed = false
      const newMeasured = new Map(measuredHeights)

      rowRefs.current.forEach((el, rowIndex) => {
        if (!el) return
        const measured = el.offsetHeight
        const current = newMeasured.get(rowIndex)
        // Only update if different (avoid infinite loops)
        if (measured > 0 && measured !== current) {
          newMeasured.set(rowIndex, measured)
          changed = true
        }
      })

      if (changed) {
        setMeasuredHeights(newMeasured)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [startRow, endRow, measuredHeights])

  // Row ref callback
  const setRowRef = useCallback((rowIndex: number, el: HTMLDivElement | null) => {
    if (el) {
      rowRefs.current.set(rowIndex, el)
    } else {
      rowRefs.current.delete(rowIndex)
    }
  }, [])

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }, [])

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="overflow-auto"
      style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        {rows.slice(startRow, endRow).map((row, idx) => {
          const globalRowIndex = startRow + idx
          const top = cumulativeHeights[globalRowIndex]

          return (
            <div
              key={globalRowIndex}
              ref={(el) => setRowRef(globalRowIndex, el)}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-1"
              style={{
                position: 'absolute',
                top,
                left: 0,
                width: '100%',
              }}
            >
              {row.map((switchItem) => {
                const cacheKey = `${switchItem.name}|${switchItem.manufacturer || ''}`
                const hasForceCurvesCached = forceCurveCache.get(cacheKey) ?? false
                const savedPreference = forceCurvePreferencesMap.get(cacheKey)
                return (
                  <MemoizedSwitchCard
                    key={switchItem.id}
                    switch={switchItem}
                    onDelete={onDelete}
                    onEdit={onEdit}
                    showForceCurves={showForceCurves}
                    forceCurvesCached={hasForceCurvesCached}
                    savedPreference={savedPreference}
                    isSelected={selectedSwitches.has(switchItem.id)}
                    onSelectionChange={() => onSelectionChange(switchItem.id)}
                  />
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
