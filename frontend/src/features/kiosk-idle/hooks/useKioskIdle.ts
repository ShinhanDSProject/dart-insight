import { useCallback, useEffect, useRef, useState } from 'react'
import { kioskPhase, type KioskPhase } from '../model/kioskIdle'

/** 사람이 화면을 쓰고 있다고 보는 입력. 화면 안에서 전파를 막아도 받도록 capture로 듣는다 */
const INPUT_EVENTS = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const

function samePhase(a: KioskPhase, b: KioskPhase): boolean {
  return a.status === b.status && (a.status !== 'warning' || b.status !== 'warning' || a.secondsLeft === b.secondsLeft)
}

/**
 * 입력이 seconds 동안 없으면 onIdle을 한 번 부른다. 끝나기 전 몇 초 동안은 남은 초를 알려 준다(warning).
 * 입력이 있거나 stay()를 부르면 처음부터 다시 센다.
 * 대기 화면에서 뒤로 가기로 이 문서가 그대로 되살아나면(bfcache) 앞 방문자의 화면이므로 바로 onIdle을 부른다.
 */
export function useKioskIdle(seconds: number, onIdle: () => void) {
  const [phase, setPhase] = useState<KioskPhase>({ status: 'active' })
  const phaseRef = useRef<KioskPhase>(phase)
  // 세기 시작은 아래 effect가 정한다
  const lastInputRef = useRef(0)
  const leftRef = useRef(false)
  const onIdleRef = useRef(onIdle)

  useEffect(() => {
    onIdleRef.current = onIdle
  }, [onIdle])

  const update = useCallback(() => {
    const next = kioskPhase(Date.now() - lastInputRef.current, seconds)
    if (!samePhase(phaseRef.current, next)) {
      phaseRef.current = next
      setPhase(next)
    }
    if (next.status === 'leave' && !leftRef.current) {
      leftRef.current = true
      onIdleRef.current()
    }
  }, [seconds])

  const stay = useCallback(() => {
    lastInputRef.current = Date.now()
    leftRef.current = false
    // 안내가 떠 있을 때만 바로 닫는다(움직일 때마다 화면을 다시 그리지 않게)
    if (phaseRef.current.status !== 'active') update()
  }, [update])

  useEffect(() => {
    lastInputRef.current = Date.now()
    const timer = window.setInterval(update, 1000)
    for (const type of INPUT_EVENTS) window.addEventListener(type, stay, { capture: true, passive: true })
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) onIdleRef.current()
    }
    window.addEventListener('pageshow', onPageShow)
    return () => {
      window.clearInterval(timer)
      for (const type of INPUT_EVENTS) window.removeEventListener(type, stay, { capture: true })
      window.removeEventListener('pageshow', onPageShow)
    }
  }, [update, stay])

  return { phase, stay }
}
