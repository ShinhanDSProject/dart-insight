import { useEffect, useState } from 'react'

/**
 * 화면에 보이는 영역 중 가장 위에 있는 영역의 id(#385). 기업 개요 바로 가기 바가 지금 위치를 표시하는 데 쓴다.
 * 바로 가기 바 아래(위에서 rootMarginTop)부터 화면 40% 지점 사이에 걸친 영역을 지금 위치로 본다.
 */
export function useActiveSection(ids: readonly string[], rootMarginTop = 64): string | null {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)
  const key = ids.join(',')

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const visible = new Map<string, number>()
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.set(entry.target.id, entry.boundingClientRect.top)
          else visible.delete(entry.target.id)
        }
        const first = key.split(',').find((id) => visible.has(id))
        if (first !== undefined) setActive(first)
      },
      { rootMargin: `-${rootMarginTop}px 0px -60% 0px` },
    )
    const elements = key
      .split(',')
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null)
    elements.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [key, rootMarginTop])

  return active
}
