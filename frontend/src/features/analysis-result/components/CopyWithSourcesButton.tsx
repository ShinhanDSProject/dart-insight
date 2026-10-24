import { useEffect, useRef, useState } from 'react'
import { match } from 'ts-pattern'
import { copyText } from '@/shared/lib/clipboard'
import { cx } from '@/shared/lib/cx'
import { Button } from '@/shared/ui'

type CopyState = { status: 'idle' } | { status: 'copied' } | { status: 'failed' }

const COPIED_MS = 2000

interface CopyWithSourcesButtonProps {
  /** 누를 때 복사할 글을 만든다 */
  text: () => string
  /** 화면 읽기 프로그램용 대상 이름(예: '답', '풀이'). 버튼 글에 대상이 이미 있으면 뺀다 */
  target?: string
  /** 버튼 글. 기본은 '출처 포함 복사' */
  label?: string
  className?: string
}

/**
 * '출처 포함 복사'(3.10, FS-12). 답·풀이에 출처·AI 생성 표시를 붙여 복사하고, 결과를 옆에 짧게 알린다(aria-live).
 * 복사했으면 2초 뒤 안내를 지우고, 실패 안내는 다시 누를 때까지 둔다.
 */
export function CopyWithSourcesButton({ text, target, label = '출처 포함 복사', className }: CopyWithSourcesButtonProps) {
  const [state, setState] = useState<CopyState>({ status: 'idle' })
  const timer = useRef<number | undefined>(undefined)
  const mounted = useRef(true)

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      window.clearTimeout(timer.current)
    }
  }, [])

  const copy = async () => {
    window.clearTimeout(timer.current)
    setState({ status: 'idle' })
    const copied = await copyText(text())
    if (!mounted.current) return
    setState({ status: copied ? 'copied' : 'failed' })
    if (copied) timer.current = window.setTimeout(() => setState({ status: 'idle' }), COPIED_MS)
  }

  return (
    <div className={cx('copy-sources', className)}>
      <Button variant="secondary" className="copy-sources__button" onClick={() => void copy()}>
        {label}
        {target !== undefined && <span className="visually-hidden"> ({target})</span>}
      </Button>
      <span
        className={cx('copy-sources__status', state.status === 'failed' && 'copy-sources__status--error')}
        aria-live="polite"
      >
        {match(state)
          .with({ status: 'idle' }, () => '')
          .with({ status: 'copied' }, () => '복사했어요')
          .with({ status: 'failed' }, () => '복사하지 못했어요')
          .exhaustive()}
      </span>
    </div>
  )
}
