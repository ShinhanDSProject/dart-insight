import { useEffect, useRef } from 'react'
import { revealScrollLeft } from '@/shared/lib/scroll'

export interface TabItem<T extends string> {
  value: T
  label: string
}

interface TabsProps<T extends string> {
  /** 탭 묶음의 이름(nav aria-label) */
  label: string
  items: readonly TabItem<T>[]
  value: T
  onChange: (value: T) => void
}

/**
 * 밑줄 탭. 고른 탭은 굵은 남색 글자와 밑줄.
 * 탭이 주소(?tab=)를 바꾸는 화면 이동이라 tablist가 아니라 nav와 aria-current="page"로 알린다.
 * 좁은 화면에서는 한 줄 가로 스크롤이 되고(ui.css), 고른 탭이 보이도록 줄만 옮긴다(화면 세로 위치는 그대로).
 */
export function Tabs<T extends string>({ label, items, value, onChange }: TabsProps<T>) {
  const navRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const nav = navRef.current
    if (!nav || nav.scrollWidth <= nav.clientWidth) return
    const item = nav.querySelector<HTMLElement>('[aria-current="page"]')
    if (!item) return
    const navRect = nav.getBoundingClientRect()
    const itemRect = item.getBoundingClientRect()
    const left = revealScrollLeft({
      scrollLeft: nav.scrollLeft,
      viewWidth: nav.clientWidth,
      start: itemRect.left - navRect.left + nav.scrollLeft,
      size: itemRect.width,
      inset: parseFloat(getComputedStyle(nav).paddingLeft) || 0,
    })
    if (left === null) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    nav.scrollTo?.({ left, behavior: reduce ? 'auto' : 'smooth' })
  }, [value])

  return (
    <nav ref={navRef} className="tabs" aria-label={label}>
      {items.map((item) => (
        <button
          key={item.value}
          type="button"
          className="tabs__item"
          aria-current={value === item.value ? 'page' : undefined}
          onClick={() => onChange(item.value)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  )
}
