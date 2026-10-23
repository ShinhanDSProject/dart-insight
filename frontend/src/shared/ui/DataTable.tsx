import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { cx } from '@/shared/lib/cx'

type DataTableProps = {
  /** 화면 읽기용 표 설명(보이지 않음) */
  caption: ReactNode
  /** compact: 원문 표처럼 칸이 많은 표(작은 글자, 모든 칸 테두리) */
  density?: 'default' | 'compact'
  /** 가로 스크롤 상자의 className */
  scrollClassName?: string
} & ComponentPropsWithoutRef<'table'>

/** 데이터 표. 가로로 넘치면 상자 안에서 스크롤한다. thead·tbody는 children으로 넘긴다. */
export function DataTable({ caption, density = 'default', scrollClassName, className, children, ...rest }: DataTableProps) {
  return (
    <div className={cx('table-scroll', scrollClassName)}>
      <table className={cx('data-table', density === 'compact' && 'data-table--compact', className)} {...rest}>
        <caption className="visually-hidden">{caption}</caption>
        {children}
      </table>
    </div>
  )
}

type DataTableRowProps = { selected?: boolean } & ComponentPropsWithoutRef<'tr'>

/** 표의 행. selected면 강조 배경 */
export function DataTableRow({ selected = false, className, ...rest }: DataTableRowProps) {
  return <tr className={cx(selected && 'data-table__row--selected', className) || undefined} {...rest} />
}
