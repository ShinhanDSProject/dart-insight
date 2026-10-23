import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '@/shared/lib/cx'

/** attention: '검토 필요' 항목, selected: 근거를 열어 둔 항목 */
export type CardTone = 'default' | 'attention' | 'selected'

type CardProps = {
  as?: 'div' | 'section' | 'article'
  tone?: CardTone
} & ComponentPropsWithoutRef<'div'>

/** 목록 안의 카드(검색 결과·변경·근거 카드). 안쪽 배치는 className으로 정한다. */
export function Card({ as: Tag = 'div', tone = 'default', className, ...rest }: CardProps) {
  return <Tag className={cx('card', tone !== 'default' && `card--${tone}`, className)} {...rest} />
}
