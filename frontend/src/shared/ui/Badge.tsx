import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '@/shared/lib/cx'

/**
 * 작은 알약 표식(#548). neutral: 기본(회색), accent: 현재 보고서·진행 상태·'AI 생성'·변경 유형·'분석 준비'(보라),
 * attention: '검토 필요'(옅은 노랑), danger: '비교 불가'·'분석 실패'처럼 진행할 수 없는 상태(옅은 분홍)
 */
export type BadgeTone = 'neutral' | 'accent' | 'attention' | 'danger'

type BadgeProps = { tone?: BadgeTone } & ComponentPropsWithoutRef<'span'>

/** 짧은 표식. 바깥 여백은 쓰는 곳에서 정한다(className). */
export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return <span className={cx('badge', tone !== 'neutral' && `badge--${tone}`, className)} {...rest} />
}
