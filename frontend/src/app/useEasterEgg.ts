import { useCallback, useEffect, useState } from 'react'
import { KONAMI_KEYS, nextKonamiStep } from '@/shared/lib/easterEgg'

/** 화면 어디서나 코나미 코드를 다 누르면 숨은 페이지 안내를 연다(#753). Layout에 한 번만 둔다 */
export function useEasterEgg() {
  const [found, setFound] = useState(false)

  useEffect(() => {
    let step = 0
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null
      step = nextKonamiStep(step, {
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        target: target && { tagName: target.tagName, isContentEditable: target.isContentEditable },
      })
      if (step === KONAMI_KEYS.length) {
        step = 0
        setFound(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const close = useCallback(() => setFound(false), [])
  return { found, close }
}
