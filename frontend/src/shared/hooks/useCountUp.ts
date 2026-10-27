import { useEffect, useRef, useState } from 'react'
import { countUpValue, DEFAULT_COUNT_UP_MS, parseDurationMs } from '@/shared/lib/countUp'

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** 토큰 --motion-count(tokens.css). 읽지 못하면 기본값 */
function countUpDuration(): number {
  const value = getComputedStyle(document.documentElement).getPropertyValue('--motion-count')
  return parseDurationMs(value) ?? DEFAULT_COUNT_UP_MS
}

/**
 * 큰 숫자를 짧게 올라가며 보여 줄 때의 지금 값(FS-58). requestAnimationFrame으로 한 프레임에 한 번 바꾼다.
 * 처음에는 0에서, 값이 바뀌면 지금 보이는 값에서 새 값으로 간다. 값이 null이면 null(움직이지 않음).
 * 운영체제 '동작 줄이기'면 움직이지 않고 바로 최종 값이다. 화면 읽기 도구에는 최종 값을 따로 읽어 준다(StatNumber).
 */
export function useCountUp(target: number | null): number | null {
  const [shown, setShown] = useState<number | null>(() => (target === null || prefersReducedMotion() ? target : 0))
  const current = useRef(0)

  useEffect(() => {
    if (target === null) {
      current.current = 0
      setShown(null)
      return
    }
    const duration = prefersReducedMotion() ? 0 : countUpDuration()
    const from = current.current
    if (duration === 0 || from === target) {
      current.current = target
      setShown(target)
      return
    }
    let frame = 0
    let start: number | null = null
    const step = (now: number) => {
      start ??= now
      const value = countUpValue(from, target, now - start, duration)
      current.current = value
      setShown(value)
      if (value !== target) frame = window.requestAnimationFrame(step)
    }
    frame = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(frame)
  }, [target])

  return shown
}
