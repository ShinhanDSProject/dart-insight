import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '@/shared/lib/cx'

/** attention: '검토 필요'처럼 주의 색으로 구분할 거르기 */
export type ChipTone = 'neutral' | 'attention'

type ChipProps = {
  tone?: ChipTone
  /** 켜져 있는지(aria-pressed) */
  pressed: boolean
  /** 이름 뒤에 붙는 건수. null·undefined면 그리지 않는다 */
  count?: number | null
} & Omit<ComponentPropsWithoutRef<'button'>, 'aria-pressed'>

/** 목록을 거르는 둥근 켜기·끄기 버튼. 여러 개를 role="group"으로 묶어 쓴다. */
export function Chip({ tone = 'neutral', pressed, count, className, children, type = 'button', ...rest }: ChipProps) {
  return (
    <button type={type} className={cx('chip', tone !== 'neutral' && `chip--${tone}`, className)} aria-pressed={pressed} {...rest}>
      {children}
      {count !== undefined && count !== null && <span className="chip__count"> {count}</span>}
    </button>
  )
}
