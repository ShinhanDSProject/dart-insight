import { match } from 'ts-pattern'
import type { FinancialChangeItem } from '@/shared/api/results'

/** 재무 표를 정렬할 수 있는 열 */
export type FinancialSortKey = 'changeAmount' | 'changeRate'
export type SortDirection = 'descending' | 'ascending'

/** 재무 표 정렬 상태. original은 받은 순서(원문 계정 순서) 그대로 */
export type FinancialSort = { by: 'original' } | { by: FinancialSortKey; direction: SortDirection }

export const originalOrder: FinancialSort = { by: 'original' }

/** 머리글을 누를 때 다음 정렬. 같은 열은 내림차순 → 오름차순 → 원문 순서, 다른 열은 내림차순부터 */
export function nextFinancialSort(current: FinancialSort, key: FinancialSortKey): FinancialSort {
  if (current.by !== key) return { by: key, direction: 'descending' }
  return match(current.direction)
    .with('descending', (): FinancialSort => ({ by: key, direction: 'ascending' }))
    .with('ascending', () => originalOrder)
    .exhaustive()
}

/** 머리글의 aria-sort 값 */
export function ariaSortOf(sort: FinancialSort, key: FinancialSortKey): 'ascending' | 'descending' | 'none' {
  return sort.by === key ? sort.direction : 'none'
}

/** 정렬에 쓰는 값. 계산하지 못한 행은 null */
function sortValue(item: FinancialChangeItem, key: FinancialSortKey): number | null {
  if (item.changeAmount === null) return null
  return match(key)
    .with('changeAmount', () => item.changeAmount)
    .with('changeRate', () => item.changeRate)
    .exhaustive()
}

/**
 * 재무 표의 행을 정렬한다. 원래 배열은 바꾸지 않는다.
 * 계산하지 못한 행(증감액이 없거나, 증감률 정렬에서 증감률이 없는 행)은 방향과 상관없이 맨 아래에 원래 순서대로 둔다.
 * 값이 같으면 원래 순서를 지킨다.
 */
export function sortFinancialItems(items: FinancialChangeItem[], sort: FinancialSort): FinancialChangeItem[] {
  if (sort.by === 'original') return items
  const key = sort.by
  const sign = sort.direction === 'descending' ? -1 : 1
  const calculated: { item: FinancialChangeItem; value: number }[] = []
  const uncalculated: FinancialChangeItem[] = []
  for (const item of items) {
    const value = sortValue(item, key)
    if (value === null) uncalculated.push(item)
    else calculated.push({ item, value })
  }
  calculated.sort((a, b) => sign * (a.value - b.value))
  return [...calculated.map((c) => c.item), ...uncalculated]
}
