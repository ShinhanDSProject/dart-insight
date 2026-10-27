import type { CSSProperties, ReactNode } from 'react'
import { match } from 'ts-pattern'
import { cx } from '@/shared/lib/cx'

/** line 글줄 여러 개, block 큰 상자 하나(차트·표 자리), card 카드 여러 개를 한 줄에(지표 줄·카드 목록 자리) */
export type SkeletonShape = 'line' | 'block' | 'card'

interface SkeletonProps {
  /** 화면 읽기 도구에 읽어 줄 문구(보이지 않음). 예: 요약을 불러오는 중입니다… */
  label: string
  shape?: SkeletonShape
  /** line: 줄 수, card: 카드 수 */
  count?: number
  /** block·card의 높이(토큰 값, 예: var(--space-7)). 오면 채울 내용과 같은 높이로 두어 자리가 밀리지 않게 한다 */
  height?: string
  className?: string
}

/**
 * 불러오는 동안 채워질 자리의 모양(FS-58). 빙글 도는 표시 대신 내용이 올 자리를 같은 크기로 비워 둔다.
 * 묶음은 role="status"·aria-busy로 알리고 '불러오는 중' 문구는 보이지 않게 읽어 준다. 모양은 aria-hidden.
 * 동작 줄이기면 반짝임이 멈춘다(global.css).
 */
export function Skeleton({ label, shape = 'line', count, height, className }: SkeletonProps) {
  const style = height ? ({ '--skeleton-height': height } as CSSProperties) : undefined
  return (
    <div className={cx('skeleton', `skeleton--${shape}`, className)} role="status" aria-live="polite" aria-busy="true" style={style}>
      <span className="visually-hidden">{label}</span>
      {match(shape)
        .with('line', () => repeat(count ?? 3, (i) => <span key={i} className="skeleton__line" aria-hidden="true" />))
        .with('block', () => <span className="skeleton__block" aria-hidden="true" />)
        .with('card', () => repeat(count ?? 3, (i) => <span key={i} className="skeleton__card" aria-hidden="true" />))
        .exhaustive()}
    </div>
  )
}

function repeat(count: number, render: (index: number) => ReactNode) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => render(index))
}
