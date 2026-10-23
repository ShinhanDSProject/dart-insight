import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { match } from 'ts-pattern'
import { cx } from '@/shared/lib/cx'

type DataTableProps = {
  /** 화면 읽기용 표 설명(보이지 않음) */
  caption: ReactNode
  /** compact: 원문 표처럼 칸이 많은 표(작은 글자, 모든 칸 테두리). dense: 행이 많은 표(낮은 행) */
  density?: 'default' | 'dense' | 'compact'
  /** 세로로 길면 상자 안에서 스크롤하고 머리글을 위에 고정한다 */
  stickyHeader?: boolean
  /** 가로 스크롤 상자의 className */
  scrollClassName?: string
} & ComponentPropsWithoutRef<'table'>

/** 데이터 표. 가로로 넘치면 상자 안에서 스크롤한다. thead·tbody는 children으로 넘긴다. */
export function DataTable({
  caption,
  density = 'default',
  stickyHeader = false,
  scrollClassName,
  className,
  children,
  ...rest
}: DataTableProps) {
  return (
    <div className={cx('table-scroll', stickyHeader && 'table-scroll--sticky', scrollClassName)}>
      <table
        className={cx(
          'data-table',
          density === 'dense' && 'data-table--dense',
          density === 'compact' && 'data-table--compact',
          className,
        )}
        {...rest}
      >
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

export type SortState = 'ascending' | 'descending' | 'none'

type SortableHeaderProps = {
  /** 이 열의 정렬 상태. th의 aria-sort로 알린다 */
  sort: SortState
  onSort: () => void
  /** 숫자 열이면 오른쪽 정렬 */
  numeric?: boolean
  children: ReactNode
} & Omit<ComponentPropsWithoutRef<'th'>, 'children'>

/** 눌러서 정렬하는 열 머리글. 버튼은 th 안에 두고, 상태는 aria-sort와 화살표로 보인다. 증감의 ▲▼와 헷갈리지 않게 ↑↓를 쓴다 */
export function SortableHeader({ sort, onSort, numeric = false, className, children, ...rest }: SortableHeaderProps) {
  const mark = match(sort)
    .with('descending', () => '↓')
    .with('ascending', () => '↑')
    .with('none', () => '↕')
    .exhaustive()
  return (
    <th scope="col" aria-sort={sort} className={cx(numeric && 'num', className)} {...rest}>
      <button type="button" className="data-table__sort" onClick={onSort}>
        {children}
        <span className="data-table__sort-mark" aria-hidden="true">
          {mark}
        </span>
      </button>
    </th>
  )
}
