import type { ComponentPropsWithoutRef } from 'react'
import { cx } from '@/shared/lib/cx'

/** attention: '검토 필요' 항목(주의 색 테두리) */
export type CardTone = 'default' | 'attention'

type CardProps = {
  as?: 'div' | 'section' | 'article'
  tone?: CardTone
  /** 근거를 열어 둔 항목(강조 배경) */
  selected?: boolean
  /** 카드 전체를 눌러 고르는 카드(안에 카드 전체를 덮는 링크·버튼이 있음). hover·focus에 옅게 들린다. 정적 카드는 두지 않는다 */
  interactive?: boolean
} & ComponentPropsWithoutRef<'div'>

/** 목록 안의 카드(보고서·요약·변경 카드). 안쪽 배치는 className으로 정한다. */
export function Card({ as: Tag = 'div', tone = 'default', selected = false, interactive = false, className, ...rest }: CardProps) {
  return <Tag className={cx('card', tone !== 'default' && `card--${tone}`, selected && 'card--selected', interactive && 'card--interactive', className)} {...rest} />
}
