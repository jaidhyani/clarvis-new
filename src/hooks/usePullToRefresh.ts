import { useEffect, useRef } from 'preact/hooks'
import type { RefObject } from 'preact'

/**
 * Adds pull-to-refresh touch handling to an element.
 * Used for mobile session list refresh.
 */
export function usePullToRefresh(
  onRefresh: () => void,
  enabled: boolean
): RefObject<HTMLDivElement> {
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element || !enabled) return

    let startY = 0
    let isPulling = false

    const handleTouchStart = (e: TouchEvent) => {
      if (element.scrollTop === 0) {
        const touch = e.touches[0]
        if (touch) {
          startY = touch.clientY
          isPulling = true
        }
      }
    }

    const handleTouchMove = (e: TouchEvent) => {
      if (!isPulling) return

      const touch = e.touches[0]
      if (touch) {
        const pullDistance = touch.clientY - startY
        if (pullDistance > 80 && element.scrollTop === 0) {
          element.classList.add('pulling')
        }
      }
    }

    const handleTouchEnd = () => {
      if (element.classList.contains('pulling')) {
        element.classList.remove('pulling')
        onRefresh()
      }
      isPulling = false
      startY = 0
    }

    element.addEventListener('touchstart', handleTouchStart, { passive: true })
    element.addEventListener('touchmove', handleTouchMove, { passive: true })
    element.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      element.removeEventListener('touchstart', handleTouchStart)
      element.removeEventListener('touchmove', handleTouchMove)
      element.removeEventListener('touchend', handleTouchEnd)
    }
  }, [onRefresh, enabled])

  return elementRef
}
