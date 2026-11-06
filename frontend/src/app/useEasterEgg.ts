import { useCallback, useEffect, useState } from 'react'
import { nextShiftTap } from '@/shared/lib/easterEgg'

/** 화면 어디서나 Shift를 빠르게 두 번 누르면 숨은 페이지 안내를 연다(#753, #755). Layout에 한 번만 둔다 */
export function useEasterEgg() {
  const [found, setFound] = useState(false)

  useEffect(() => {
    let lastShiftAt: number | null = null
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      const next = nextShiftTap(
        lastShiftAt,
        {
          key: event.key,
          ctrlKey: event.ctrlKey,
          metaKey: event.metaKey,
          altKey: event.altKey,
          repeat: event.repeat,
          target: target && { tagName: target.tagName, isContentEditable: target.isContentEditable },
        },
        performance.now(),
      )
      lastShiftAt = next.lastShiftAt
      if (next.found) setFound(true)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const close = useCallback(() => setFound(false), [])
  return { found, close }
}
