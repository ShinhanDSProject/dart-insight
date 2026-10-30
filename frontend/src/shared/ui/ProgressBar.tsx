import type { CSSProperties } from 'react'
import { cx } from '@/shared/lib/cx'

interface ProgressBarProps {
  /** 0~1. 범위를 벗어나면 잘라 쓴다 */
  value: number
  /** 화면 읽기 도구가 읽는 이름(예: '분석 진행률') */
  label: string
  className?: string
}

/** 가는 진행 막대(#549). 남색 막대가 옅은 회색 길 위에서 부드럽게 늘어난다. 동작 줄이기면 바로 바뀐다(global.css) */
export function ProgressBar({ value, label, className }: ProgressBarProps) {
  const ratio = Math.min(1, Math.max(0, value))
  const percent = Math.round(ratio * 100)
  return (
    <div
      className={cx('progress-bar', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      style={{ '--progress': ratio } as CSSProperties}
    >
      <span className="progress-bar__fill" />
    </div>
  )
}
