import { useEffect, useRef, type ComponentPropsWithoutRef } from 'react'
import { cx } from '@/shared/lib/cx'

type SidePanelProps = {
  /** Esc를 누르면 부른다 */
  onClose: () => void
} & ComponentPropsWithoutRef<'div'>

/**
 * 화면 오른쪽에 붙는 보조 패널(근거 보기 등). 본문을 가리지 않도록 넓은 화면에서는 본문 오른쪽 여백을 비우고,
 * 좁은 화면에서는 아래에서 올라오는 시트가 된다. 본문은 계속 쓸 수 있어 모달이 아니다.
 * 이름은 aria-labelledby로 붙이고, 열릴 때 초점은 쓰는 쪽이 옮긴다(스크롤은 바꾸지 않음).
 */
export function SidePanel({ onClose, className, ...rest }: SidePanelProps) {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onCloseRef.current()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    document.body.classList.add('has-side-panel')
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.classList.remove('has-side-panel')
    }
  }, [])

  // aside에는 role="dialog"를 줄 수 없어(ARIA in HTML) div에 붙인다
  return <div role="dialog" aria-modal="false" className={cx('side-panel', className)} {...rest} />
}
