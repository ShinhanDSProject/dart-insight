import { useEffect, useRef, useState } from 'react'

/**
 * 위에 붙는 기업 화면 헤더 바(FS-58). 바로 위에 둔 센티넬(높이 0)이 화면 위로 나가면 바가 붙기 시작한 것이라
 * compact를 켠다. 스크롤 이벤트를 쓰지 않고 IntersectionObserver 하나로 본다.
 * 센티넬은 바보다 앞에 있어 바 모양이 바뀌어도 센티넬 위치는 그대로다(켜졌다 꺼졌다 반복하지 않음).
 * 바의 높이(height)는 그 아래에 붙는 바로 가기 바가 바 밑에 붙도록 CSS 변수로 넘긴다.
 * 이 브라우저에 관찰 API가 없으면 compact는 꺼진 채이고 높이는 0이다.
 */
export function useCompactHeader<S extends HTMLElement, B extends HTMLElement>() {
  const sentinelRef = useRef<S>(null)
  const barRef = useRef<B>(null)
  const [compact, setCompact] = useState(false)
  const [height, setHeight] = useState(0)

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(([entry]) => {
      setCompact(!entry.isIntersecting && entry.boundingClientRect.top < 0)
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const bar = barRef.current
    if (!bar || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      setHeight(Math.round(entry.borderBoxSize?.[0]?.blockSize ?? bar.getBoundingClientRect().height))
    })
    observer.observe(bar)
    return () => observer.disconnect()
  }, [])

  return { sentinelRef, barRef, compact, height }
}
