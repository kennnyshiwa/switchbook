'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import { MasterSwitch } from '@/app/switches/browse/page-client'

interface VirtualSwitchListProps {
  switches: MasterSwitch[]
  onSwitchClick: (switchItem: MasterSwitch) => void
  selectedForComparison: Set<string>
  isComparisonMode: boolean
}

const BREAKPOINTS = {
  base: 2, // default 2 columns
  sm: { min: 640, cols: 3 },
  md: { min: 768, cols: 4 },
  lg: { min: 1024, cols: 5 },
  xl: { min: 1280, cols: 6 },
}

const FIXED_IMAGE_HEIGHT = 200 // Placeholder; calculate based on aspect-square
const TEXT_PADDING = 16 // px for text area below image
const GAP = 16 // gap-4 = 1rem = 16px
const CARD_PADDING = 8 // internal card padding estimate

const NAME_FONT = '500 0.875rem sans-serif' // font-medium text-sm
const MANUFACTURER_FONT = '400 0.75rem sans-serif' // text-xs

export default function VirtualSwitchList({ switches, onSwitchClick, selectedForComparison, isComparisonMode }: VirtualSwitchListProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 })
  const [scrollTop, setScrollTop] = useState(0)

  const [pretext, setPretext] = useState<any>(null)

  useEffect(() => {
    import('@/lib/pretext/layout.mjs').then(module => {
      setPretext(module)
    })
  }, [])

  // Calculate column count based on width
  const columnCount = useMemo(() => {
    const width = containerSize.width
    if (width >= BREAKPOINTS.xl.min) return BREAKPOINTS.xl.cols
    if (width >= BREAKPOINTS.lg.min) return BREAKPOINTS.lg.cols
    if (width >= BREAKPOINTS.md.min) return BREAKPOINTS.md.cols
    if (width >= BREAKPOINTS.sm.min) return BREAKPOINTS.sm.cols
    return BREAKPOINTS.base
  }, [containerSize.width])

  // Calculate card width
  const cardWidth = useMemo(() => {
    if (!containerSize.width || !columnCount) return 0
    return (containerSize.width - GAP * (columnCount - 1)) / columnCount
  }, [containerSize.width, columnCount])

  // Precompute row heights using Pretext for variable name text
  const { rows, rowHeights, cumulativeHeights, totalHeight } = useMemo(() => {
    if (!switches.length || !columnCount || !cardWidth || !pretext) {
      return { rows: [], rowHeights: [], cumulativeHeights: [], totalHeight: 0 }
    }

    const imageHeight = cardWidth // aspect-square

    const nameMaxWidth = cardWidth - CARD_PADDING * 2

    const newRows = []
    const newRowHeights = []
    let cumHeight = 0
    const newCumulative = []

    for (let i = 0; i < switches.length; i += columnCount) {
      const rowSwitches = switches.slice(i, i + columnCount)
      let maxTextHeight = 0

      for (const sw of rowSwitches) {
        const prepared = pretext.prepare(sw.name, NAME_FONT, { whiteSpace: 'normal' })
        const layoutResult = pretext.layout(prepared, nameMaxWidth, 16) // lineHeight estimate for text-sm

        const nameHeight = layoutResult.height

        const manufacturerHeight = sw.manufacturer ? 16 : 0 // fixed for 1 line

        const textHeight = nameHeight + manufacturerHeight + TEXT_PADDING

        if (textHeight > maxTextHeight) maxTextHeight = textHeight
      }

      const rowHeight = imageHeight + maxTextHeight + GAP // add gap for row spacing if needed

      newRows.push(rowSwitches)
      newRowHeights.push(rowHeight)
      newCumulative.push(cumHeight)
      cumHeight += rowHeight
    }

    return { rows: newRows, rowHeights: newRowHeights, cumulativeHeights: newCumulative, totalHeight: cumHeight }
  }, [switches, columnCount, cardWidth, pretext])

  // Find visible rows
  const { startRow, endRow } = useMemo(() => {
    if (!cumulativeHeights.length) return { startRow: 0, endRow: 0 }

    // Binary search for start row
    let low = 0
    let high = cumulativeHeights.length - 1
    while (low < high) {
      const mid = Math.floor((low + high) / 2)
      if (cumulativeHeights[mid] < scrollTop) {
        low = mid + 1
      } else {
        high = mid
      }
    }
    const start = low

    // Find end row by advancing until cumulative > scrollTop + height + buffer
    let end = start
    const buffer = containerSize.height * 2 // overscan 2 viewports
    while (end < cumulativeHeights.length && cumulativeHeights[end] < scrollTop + containerSize.height + buffer) {
      end++
    }

    return { startRow: Math.max(0, start - 2), endRow: Math.min(rows.length, end + 2) } // extra overscan
  }, [scrollTop, containerSize.height, cumulativeHeights, rows.length])

  // Resize observer — container ref is always mounted
  useEffect(() => {
    if (!containerRef.current) return

    const resizeObserver = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect
      setContainerSize({ width, height })
    })

    resizeObserver.observe(containerRef.current)

    return () => resizeObserver.disconnect()
  }, [])

  // Scroll handler
  const handleScroll = () => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop)
    }
  }

  return (
    <div 
      ref={containerRef} 
      onScroll={handleScroll}
      className="overflow-auto relative" 
      style={{ height: 'calc(100vh - 200px)', minHeight: '600px' }}
    >
      {!pretext ? (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-sm text-gray-500">Preparing layout engine...</p>
          </div>
        </div>
      ) : (
      <div style={{ height: totalHeight, position: 'relative' }}>
        {rows.slice(startRow, endRow).map((row, rowIndex) => {
          const globalRowIndex = startRow + rowIndex
          const top = cumulativeHeights[globalRowIndex]

          return (
            <div
              key={globalRowIndex}
              className={`grid gap-4 p-6`}
              style={{
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                position: 'absolute',
                top,
                left: 0,
                width: '100%',
                height: rowHeights[globalRowIndex],
              }}
            >
              {row.map((switchItem) => (
                <div
                  key={switchItem.id}
                  onClick={() => onSwitchClick(switchItem)}
                  className="group cursor-pointer relative"
                >
                  {isComparisonMode && (
                    <div className={`absolute top-2 right-2 z-10 rounded-full p-1 transition-opacity ${
                      selectedForComparison.has(switchItem.id)
                        ? 'bg-green-500 text-white opacity-100'
                        : 'bg-gray-600 text-white opacity-0 group-hover:opacity-60'
                    }`}>
                      {selectedForComparison.has(switchItem.id) ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                      )}
                    </div>
                  )}
                  <div className={`relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden mb-2 border-2 transition-all duration-200 ${
                    isComparisonMode && selectedForComparison.has(switchItem.id)
                      ? 'border-green-500 dark:border-green-400'
                      : 'border-transparent hover:border-blue-500 dark:hover:border-blue-400'
                  }`}>
                    {(switchItem.images && switchItem.images.length > 0) ? (
                      <img
                        src={switchItem.images[0].url}
                        alt={switchItem.name}
                        loading="lazy"
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : switchItem.imageUrl ? (
                      <img
                        src={switchItem.imageUrl}
                        alt={switchItem.name}
                        loading="lazy"
                        className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-200"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg className="w-16 h-16 text-gray-400 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <h3 className="text-sm font-medium text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {switchItem.name}
                      </h3>
                      {switchItem.inCollection && (
                        <div className="bg-green-500 text-white p-0.5 rounded-full">
                          <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                    </div>
                    {switchItem.manufacturer && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {switchItem.manufacturer}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
      )}
    </div>
  );
}
