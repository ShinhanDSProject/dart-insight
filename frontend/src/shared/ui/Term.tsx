import { useEffect, useId, useLayoutEffect, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'
import { glossary, type GlossaryKey } from '@/shared/lib/glossary'

/** 설명 상자와 화면 가장자리 사이에 남길 여백(px). CSS의 max-width 계산과 같은 값 */
const VIEWPORT_GAP = 16

interface TermProps {
  /** 용어 사전(shared/lib/glossary)의 항목 */
  name: GlossaryKey
  /** 화면에 보이는 원래 문구. 바꾸지 않고 그대로 감싼다 */
  children: ReactNode
}

/**
 * 공시 용어 풀이(FS-36). 문구를 점선 밑줄·ⓘ가 붙은 버튼으로 감싸고, 누르면(Enter·Space 포함) 아래에 작은 설명 상자를 연다.
 * Esc를 누르면 닫고 버튼으로 초점을 돌려주며, 바깥을 누르거나 초점이 밖으로 나가도 닫힌다. 좁은 화면에서는 상자를 화면 안으로 당긴다.
 */
export function Term({ name, children }: TermProps) {
  const entry = glossary[name]
  const [open, setOpen] = useState(false)
  const popoverId = useId()
  const rootRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!open) return
    function closeOnOutside(event: PointerEvent) {
      if (event.target instanceof Node && rootRef.current?.contains(event.target)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    return () => document.removeEventListener('pointerdown', closeOnOutside)
  }, [open])

  // 오른쪽 끝에 있는 용어도 상자가 화면 밖으로 나가지 않게 왼쪽으로 당긴다
  useLayoutEffect(() => {
    const popover = popoverRef.current
    if (!open || !popover) return
    popover.style.setProperty('--term-shift', '0px')
    const rect = popover.getBoundingClientRect()
    const overflow = rect.right - (window.innerWidth - VIEWPORT_GAP)
    const shift = overflow > 0 ? Math.min(overflow, rect.left - VIEWPORT_GAP) : 0
    popover.style.setProperty('--term-shift', `${-Math.max(shift, 0)}px`)
  }, [open])

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !open) return
    event.stopPropagation()
    setOpen(false)
    buttonRef.current?.focus()
  }

  function onBlur(event: FocusEvent) {
    if (event.relatedTarget instanceof Node && rootRef.current?.contains(event.relatedTarget)) return
    setOpen(false)
  }

  return (
    <span ref={rootRef} className="term" onKeyDown={onKeyDown} onBlur={onBlur}>
      <button
        ref={buttonRef}
        type="button"
        className="term__button"
        aria-expanded={open}
        aria-controls={popoverId}
        aria-describedby={open ? popoverId : undefined}
        onClick={() => setOpen((v) => !v)}
      >
        {children}
        <span className="term__icon" aria-hidden="true">
          ⓘ
        </span>
      </button>
      <span ref={popoverRef} id={popoverId} role="tooltip" className="term__popover" hidden={!open}>
        <span className="term__label">용어 풀이 · {entry.term}</span>
        <span className="term__definition">{entry.definition}</span>
      </span>
    </span>
  )
}
