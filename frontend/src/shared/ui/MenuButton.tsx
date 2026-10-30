import { useEffect, useId, useRef, useState, type ComponentPropsWithRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'

interface MenuButtonProps {
  /** 펼침 버튼의 글자(뒤에 ▾가 붙는다) */
  label: ReactNode
  /** 버튼 이름을 글자와 다르게 읽힐 때 */
  'aria-label'?: string
  /** button: 보조 버튼(알약), chip: 거르기 칩과 같은 모양 */
  trigger?: 'button' | 'chip'
  /** chip일 때 펼친 목록 안의 값이 지금 골라져 있으면 칩을 채운다 */
  selected?: boolean
  /** 펼친 상자를 버튼의 어느 쪽 끝에 맞출지 */
  align?: 'start' | 'end'
  className?: string
  /** 펼친 상자 안. 함수면 닫는 함수를 받아, 항목을 고른 뒤 닫을 수 있다 */
  children: ReactNode | ((close: () => void) => ReactNode)
}

/**
 * 버튼을 누르면 아래로 펼치는 작은 상자(#550). 내보내기·그 밖의 표·이 기업의 다른 분석처럼 자주 쓰지 않는 동작을 묶는다.
 * aria-expanded·aria-controls로 펼침을 알리고, Esc로 닫으면 초점을 버튼으로 돌려주며, 바깥을 누르면 닫는다.
 */
export function MenuButton({
  label,
  'aria-label': ariaLabel,
  trigger = 'button',
  selected = false,
  align = 'end',
  className,
  children,
}: MenuButtonProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()
  const close = () => setOpen(false)

  useEffect(() => {
    if (!open) return
    const onMouseDown = (event: MouseEvent) => {
      if (rootRef.current && event.target instanceof Node && !rootRef.current.contains(event.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Escape' || !open) return
    // 뒤에 열린 근거 패널(SidePanel)까지 함께 닫히지 않게 한다
    event.stopPropagation()
    setOpen(false)
    buttonRef.current?.focus()
  }

  return (
    <div ref={rootRef} className={cx('menu-button', className)} onKeyDown={onKeyDown}>
      <button
        ref={buttonRef}
        type="button"
        className={cx(
          trigger === 'chip' ? 'chip' : 'button button--secondary',
          trigger === 'chip' && selected && 'chip--selected',
        )}
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        {label}
        <span className="menu-button__caret" aria-hidden="true">
          ▾
        </span>
      </button>
      <div id={panelId} className={cx('menu-button__panel', `menu-button__panel--${align}`)} hidden={!open}>
        {typeof children === 'function' ? children(close) : children}
      </div>
    </div>
  )
}

/** 펼친 상자 안의 항목 버튼. 지금 고른 값이면 aria-pressed를 넘긴다(옅은 바탕·굵게). 링크 항목은 className="menu-button__item"을 쓴다 */
export function MenuItem({ className, type = 'button', ...rest }: ComponentPropsWithRef<'button'>) {
  return <button type={type} className={cx('menu-button__item', className)} {...rest} />
}
