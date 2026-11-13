import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState, type ReactNode } from 'react'
import { PageRevealContext } from '@/shared/hooks/useRevealReady'
import { cx } from '@/shared/lib/cx'
import {
  nextRevealPhase,
  REVEAL_ENTER_MS,
  REVEAL_MAX_WAIT_MS,
  shouldSkipReveal,
  type RevealPhase,
} from '@/shared/lib/pageReveal'

interface PageRevealProps {
  /** 기다리는 동안 보일 화면 모양(Skeleton). 짧게 끝나면 보이지 않도록 CSS가 조금 늦게 띄운다 */
  fallback: ReactNode
  children: ReactNode
}

/**
 * 화면의 주요 데이터가 응답할 때까지 내용을 가렸다가 한 번에 보인다(#960). 칸들은 useRevealReady로 준비 여부를 알린다.
 * 내용은 가리는 동안에도 그려 두어(데이터 훅이 돌고 자리를 차지함) 보일 때 자리가 밀리지 않고,
 * 안의 등장 움직임은 멈춰 있다가 보이는 순간 시작한다(ui.css). 최대 REVEAL_MAX_WAIT_MS만 기다린다.
 * 보인 뒤 REVEAL_ENTER_MS 동안은 page-reveal--entering이라 화면 CSS가 구역마다 차례 지연을 걸 수 있다.
 */
export function PageReveal({ fallback, children }: PageRevealProps) {
  const pending = useRef(new Set<string>())
  const [checks, recheck] = useReducer((n: number) => n + 1, 0)
  const [timedOut, setTimedOut] = useState(false)
  const [phase, setPhase] = useState<RevealPhase>(() =>
    shouldSkipReveal({ reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false })
      ? 'shown'
      : 'waiting',
  )

  const report = useCallback((id: string, settled: boolean) => {
    const waiting = pending.current
    if (settled !== waiting.has(id)) return
    if (settled) waiting.delete(id)
    else waiting.add(id)
    recheck()
  }, [])

  // 안의 칸들이 먼저 알린 뒤(자식 layout effect가 먼저 돈다) 그리기 전에 판단한다
  useLayoutEffect(() => {
    setPhase((current) => nextRevealPhase(current, { pending: pending.current.size, timedOut }))
  }, [checks, timedOut])

  // 발표에서 넘어온 첫 화면(#from-deck)은 준비될 때까지 화면 전체를 가려 둔다(index.html). 준비되면 알린다
  useLayoutEffect(() => {
    if (phase !== 'waiting') document.documentElement.dataset.introReady = ''
  }, [phase])

  useEffect(() => {
    if (phase === 'shown') return
    const timer =
      phase === 'waiting'
        ? setTimeout(() => setTimedOut(true), REVEAL_MAX_WAIT_MS)
        : setTimeout(() => setPhase('shown'), REVEAL_ENTER_MS)
    return () => clearTimeout(timer)
  }, [phase])

  const waiting = phase === 'waiting'
  return (
    <PageRevealContext value={report}>
      <div className={cx('page-reveal', `page-reveal--${phase}`)} aria-busy={waiting}>
        {waiting && <div className="page-reveal__fallback">{fallback}</div>}
        <div className="page-reveal__content" inert={waiting}>
          {children}
        </div>
      </div>
    </PageRevealContext>
  )
}
