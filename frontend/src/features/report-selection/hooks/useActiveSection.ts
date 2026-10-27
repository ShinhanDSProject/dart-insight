import { useCallback, useEffect, useRef, useState } from 'react'
import { pickActiveSection } from '../model/activeSection'

/**
 * 기업 개요 바로 가기 바가 '지금 위치'로 표시할 영역의 id(#385, #434).
 * 스크롤·창 크기가 바뀔 때(한 프레임에 한 번) 영역 위치를 재고 pickActiveSection 규칙으로 고른다.
 * lineOffset은 위에 붙은 기업 탭 줄(FS-58, 약 56px)과 바로 가기 바 아래 기준선(px). prefer(id)로 바로 가기에서 누른 영역을 알려 주면,
 * 나란히 놓여 위치가 같은 영역 가운데 그 영역을 고른다.
 */
export function useActiveSection(
  ids: readonly string[],
  lineOffset = 136,
): { active: string | null; prefer: (id: string) => void } {
  const [active, setActive] = useState<string | null>(ids[0] ?? null)
  const preferred = useRef<string | null>(null)
  const prefer = useCallback((id: string) => {
    preferred.current = id
    setActive(id)
  }, [])
  const key = ids.join(',')

  useEffect(() => {
    const sectionIds = key.split(',')
    let frame = 0
    const measure = () => {
      frame = 0
      const sections = sectionIds.flatMap((id) => {
        const el = document.getElementById(id)
        return el ? [{ id, top: el.getBoundingClientRect().top }] : []
      })
      const doc = document.documentElement
      const atBottom = window.scrollY + window.innerHeight >= doc.scrollHeight - 2
      const next = pickActiveSection(sections, lineOffset, atBottom, window.innerHeight, preferred.current)
      if (next !== null) setActive(next)
    }
    const schedule = () => {
      if (frame === 0) frame = window.requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      if (frame !== 0) window.cancelAnimationFrame(frame)
    }
  }, [key, lineOffset])

  return { active, prefer }
}
