import { useEffect, useState, type RefObject } from 'react'

/**
 * 요소의 안쪽 폭(px, 정수). 폭이 바뀌면 다시 잰다(ResizeObserver).
 * 아직 재지 못했거나 잴 수 없는 환경(ResizeObserver 없음, 폭 0)이면 0이다. 부르는 쪽이 기본 폭을 정한다.
 */
export function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    setWidth(Math.round(element.clientWidth))
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width)))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])
  return width
}
