import type { ComponentPropsWithRef, ComponentPropsWithoutRef } from 'react'
import { cx } from '@/shared/lib/cx'

type PanelProps = { as?: 'section' | 'div' } & ComponentPropsWithoutRef<'section'>

/** 화면의 큰 묶음 상자(흰 바탕, 1px 테두리). 이름은 aria-label이나 PanelTitle + aria-labelledby로 붙인다. */
export function Panel({ as: Tag = 'section', className, ...rest }: PanelProps) {
  return <Tag className={cx('panel', className)} {...rest} />
}

type PanelTitleProps = { as?: 'h2' | 'h3' | 'h4' } & ComponentPropsWithRef<'h2'>

/** 패널 제목. 문서 구조에 맞는 제목 수준을 as로 고른다(기본 h2). */
export function PanelTitle({ as: Tag = 'h2', className, ...rest }: PanelTitleProps) {
  return <Tag className={cx('panel__title', className)} {...rest} />
}
