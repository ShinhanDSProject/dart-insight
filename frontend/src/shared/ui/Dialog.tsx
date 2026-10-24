import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'
import { Button } from './Button'
import { Icon } from './Icon'

const focusableSelector =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface DialogProps {
  /** 제목 요소의 id(aria-labelledby) */
  titleId: string
  title: ReactNode
  /** Esc·닫기 버튼 */
  onClose: () => void
  className?: string
  children: ReactNode
}

/**
 * 화면 가운데 뜨는 모달 대화상자(design-system 4-10). 열리면 닫기 버튼으로 초점을 옮기고, Tab은 안에서만 돈다.
 * Esc·닫기 버튼으로 닫히고, 닫히면 열기 전에 초점이 있던 곳으로 돌려준다.
 */
export function Dialog({ titleId, title, onClose, className, children }: DialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusFirst = () => dialogRef.current?.querySelector<HTMLElement>(focusableSelector)?.focus()
    focusFirst()
    // 초점이 대화상자 밖으로 나가지 않게 한다(바깥 누르기는 초점을 옮기지 않음)
    const onFocusIn = (event: FocusEvent) => {
      if (dialogRef.current && event.target instanceof Node && !dialogRef.current.contains(event.target)) focusFirst()
    }
    const onMouseDown = (event: MouseEvent) => {
      if (dialogRef.current && event.target instanceof Node && !dialogRef.current.contains(event.target)) {
        event.preventDefault()
      }
    }
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('mousedown', onMouseDown)
      if (previous?.isConnected) previous.focus()
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      // 뒤에 열린 보조 패널(SidePanel)까지 함께 닫히지 않게 한다
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || !dialogRef.current) return
    const focusables = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(focusableSelector))
    if (focusables.length === 0) return
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div className="dialog-backdrop">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx('dialog', className)}
        onKeyDown={onKeyDown}
      >
        <div className="dialog__head">
          <h2 id={titleId} className="dialog__title">
            {title}
          </h2>
          <Button variant="icon" aria-label="닫기" onClick={onClose}>
            <Icon name="x" />
          </Button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** 키보드 키 표시 */
export function Kbd({ className, children }: { className?: string; children: ReactNode }) {
  return <kbd className={cx('kbd', className)}>{children}</kbd>
}
