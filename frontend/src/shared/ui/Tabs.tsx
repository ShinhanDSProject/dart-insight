import { useEffect, useLayoutEffect, useRef } from 'react'
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
 * 밑줄은 탭마다 그리지 않고 하나(tabs__indicator)를 고른 탭 아래로 옮긴다(FS-58). 위치를 재지 못하면(글꼴 전 등)
 * 고른 탭의 자기 밑줄을 그대로 쓴다. 처음 자리 잡을 때는 움직이지 않고, 동작 줄이기면 옮김도 끈다(global.css).
 */
export function Tabs<T extends string>({ label, items, value, onChange }: TabsProps<T>) {
  const navRef = useRef<HTMLElement>(null)
  const indicatorRef = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const nav = navRef.current
    const indicator = indicatorRef.current
    if (!nav || !indicator) return
    const place = () => {
      const item = nav.querySelector<HTMLElement>('[aria-current="page"]')
      if (!item || item.offsetWidth === 0) {
        delete nav.dataset.indicator
        return
      }
      const first = nav.dataset.indicator !== 'ready'
      // 처음 자리 잡을 때는 왼쪽 끝에서 미끄러져 오지 않게 옮김을 잠깐 끈다
      if (first) indicator.style.transition = 'none'
      indicator.style.width = `${item.offsetWidth}px`
      indicator.style.transform = `translateX(${item.offsetLeft}px)`
      nav.dataset.indicator = 'ready'
      if (first) {
        void indicator.offsetWidth
        indicator.style.transition = ''
      }
    }
    place()
    if (typeof ResizeObserver === 'undefined') return
    // 글꼴이 늦게 오거나 폭이 바뀌어 탭 너비가 달라지면 다시 잰다
    const observer = new ResizeObserver(place)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [value, items])

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
      <span ref={indicatorRef} className="tabs__indicator" aria-hidden="true" />
    </nav>
  )
}
