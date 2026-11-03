import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/shared/ui'

export interface MenuItem {
  label: string
  onSelect: () => void
}

/**
 * 글·댓글의 ⋯ 메뉴(신고, 내 것이면 수정·삭제). 누르면 아래에 버튼 목록이 열리고, 고르거나 Esc·바깥을 누르면 닫힌다.
 * 고를 것이 없으면 그리지 않는다.
 */
export function CommunityMenu({ label, items }: { label: string; items: readonly MenuItem[] }) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (items.length === 0) return null
  return (
    <div
      ref={rootRef}
      className="community-menu"
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.stopPropagation()
          setOpen(false)
        }
      }}
    >
      <Button variant="icon" aria-label={label} aria-expanded={open} aria-controls={`${id}-menu`} onClick={() => setOpen((v) => !v)}>
        <span aria-hidden="true">⋯</span>
      </Button>
      {open && (
        <ul id={`${id}-menu`} className="community-menu__list">
          {items.map((item) => (
            <li key={item.label}>
              <Button
                variant="link"
                className="community-menu__item"
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.label}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
