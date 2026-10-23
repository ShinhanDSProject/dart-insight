import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '@/shared/lib/cx'

/** neutral: 기본(회색), accent: 현재 보고서·진행 상태·'AI 생성'·변경 유형, attention: '검토 필요' */
export type BadgeTone = 'neutral' | 'accent' | 'attention'

type BadgeProps = { tone?: BadgeTone } & ComponentPropsWithoutRef<'span'>

/** 짧은 표식. 바깥 여백은 쓰는 곳에서 정한다(className). */
export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return <span className={cx('badge', tone !== 'neutral' && `badge--${tone}`, className)} {...rest} />
}
