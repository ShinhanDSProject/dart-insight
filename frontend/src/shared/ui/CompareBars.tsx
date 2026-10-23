import type { CSSProperties } from 'react'
import { compareLayout, type Span } from '@/shared/lib/compare'
import { cx } from '@/shared/lib/cx'

export interface CompareSide {
  /** 예: 이전 · 2025.06.30 */
  label: string
  value: number | null
  /** 화면에 보이는 값(단위 포함). 값이 없으면 사유 */
  text: string
}

interface CompareBarsProps {
  previous: CompareSide
  current: CompareSide
  className?: string
}

/**
 * 이전·현재 두 값을 한 축에 놓은 작은 막대(FS-3 R10). 숫자를 대신하지 않고 곁에 둔다:
 * 값 글자는 그대로 읽히고 막대는 화면 읽기에서 숨긴다. 없는 값은 막대 없이 사유 글자만 보인다.
 */
export function CompareBars({ previous, current, className }: CompareBarsProps) {
  const layout = compareLayout(previous.value, current.value)
  if (layout === null) return null
  return (
    <div className={cx('compare-bars', className)}>
      <CompareRow side={previous} span={layout.previous} zero={layout.zero} tone="previous" />
      <CompareRow side={current} span={layout.current} zero={layout.zero} tone="current" />
    </div>
  )
}

function CompareRow({ side, span, zero, tone }: { side: CompareSide; span: Span | null; zero: number; tone: 'previous' | 'current' }) {
  const negative = side.value !== null && side.value < 0
  return (
    <div className="compare-bars__row">
      <span className="compare-bars__label">{side.label}</span>
      <span className="compare-bars__track" aria-hidden="true">
        {zero > 0 && <span className="compare-bars__zero" style={{ left: `${zero}%` }} />}
        {span && (
          <span
            className={cx('compare-bars__bar', `compare-bars__bar--${tone}`, negative && 'compare-bars__bar--negative')}
            style={{ left: `${span.left}%`, width: `${span.width}%` } as CSSProperties}
          />
        )}
      </span>
      <span className="compare-bars__value">{side.text}</span>
    </div>
  )
}
