import type { ComponentPropsWithRef, ComponentPropsWithoutRef } from 'react'
import { cx } from '@/shared/lib/cx'

type FieldLabelProps = { as?: 'label' | 'span' } & ComponentPropsWithoutRef<'label'>

/** 입력·선택·세그먼트 앞의 굵은 이름. 입력이 아닌 것(세그먼트·값 표시)의 이름은 as="span"에 id를 주고 aria-labelledby로 잇는다. */
export function FieldLabel({ as: Tag = 'label', className, ...rest }: FieldLabelProps) {
  return <Tag className={cx('field-label', className)} {...rest} />
}

/** 이름 옆이나 아래의 보조 설명(작은 회색 글자) */
export function FieldHint({ className, ...rest }: ComponentPropsWithoutRef<'span'>) {
  return <span className={cx('field-hint', className)} {...rest} />
}

type InputProps = { invalid?: boolean } & Omit<ComponentPropsWithRef<'input'>, 'aria-invalid'>

/** 글자 입력창. invalid면 오류 색 테두리와 aria-invalid. ref는 input에 붙는다 */
export function Input({ invalid = false, className, ...rest }: InputProps) {
  return <input className={cx('input', invalid && 'input--error', className)} aria-invalid={invalid} {...rest} />
}

/** 선택창 */
export function Select({ className, ...rest }: ComponentPropsWithoutRef<'select'>) {
  return <select className={cx('select', className)} {...rest} />
}
