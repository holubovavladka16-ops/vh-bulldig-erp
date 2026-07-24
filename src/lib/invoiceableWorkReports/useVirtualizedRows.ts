import { useRef, useState } from 'react'

export interface VirtualWindow {
  startIndex: number
  endIndex: number
  topSpacerHeight: number
  bottomSpacerHeight: number
  containerProps: {
    ref: React.RefObject<HTMLDivElement>
    onScroll: () => void
    style: { maxHeight: number; overflowY: 'auto' }
  }
}

const OVERSCAN = 8

/**
 * Jednoduchá, na knihovnách nezávislá virtualizace řádků tabulky – při
 * velkém počtu položek (stovky až tisíce) se vykreslují jen řádky viditelné
 * v okně + malý přesah, zbytek nahrazují prázdné vyrovnávací řádky, aby
 * scrollbar odpovídal skutečné výšce. Aktivuje se až od `threshold` řádků,
 * aby u běžných (malých) výkazů nic neomezovala.
 */
export function useVirtualizedRows(itemCount: number, rowHeight: number, containerHeight: number, threshold = 60) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const isVirtualized = itemCount > threshold

  if (!isVirtualized) {
    return {
      isVirtualized: false as const,
      startIndex: 0,
      endIndex: itemCount,
      topSpacerHeight: 0,
      bottomSpacerHeight: 0,
      containerRef,
      onScroll: () => {},
      containerStyle: undefined as { maxHeight: number; overflowY: 'auto' } | undefined,
    }
  }

  const visibleCount = Math.ceil(containerHeight / rowHeight)
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - OVERSCAN)
  const endIndex = Math.min(itemCount, startIndex + visibleCount + OVERSCAN * 2)

  return {
    isVirtualized: true as const,
    startIndex,
    endIndex,
    topSpacerHeight: startIndex * rowHeight,
    bottomSpacerHeight: (itemCount - endIndex) * rowHeight,
    containerRef,
    onScroll: () => setScrollTop(containerRef.current?.scrollTop ?? 0),
    containerStyle: { maxHeight: containerHeight, overflowY: 'auto' as const },
  }
}
