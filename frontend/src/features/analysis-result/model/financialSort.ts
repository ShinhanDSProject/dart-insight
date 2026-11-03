import { match } from 'ts-pattern'
import type { FinancialChangeItem, FinancialOrder } from '@/shared/api/results'

/**
 * 표 설정의 계정 순서(FS-68 AC1). amount는 증감액 절댓값이 큰 순으로 화면에서 정렬하고(기본),
 * document·scale은 서버가 준 순서(#480)를 그대로 쓴다.
 */
export type FinancialTableOrder = 'amount' | FinancialOrder

/** 서버에 보낼 순서. 증감액 큰 순은 원문 순서로 받아 화면에서 정렬한다 */
export function apiOrderOf(order: FinancialTableOrder): FinancialOrder {
  return match(order)
    .with('amount', (): FinancialOrder => 'document')
    .with('document', 'scale', (o) => o)
    .exhaustive()
}

/**
 * 표 설정의 순서대로 계정을 놓는다. 원래 배열은 바꾸지 않는다.
 * 증감액 큰 순은 증감액 절댓값이 큰 것부터이고, 같으면 원래 순서, 증감액을 계산하지 못한 행은 맨 아래에 원래 순서대로 둔다.
 * 앞 행과 이전·현재 금액이 똑같은 '…총계'(예: 자산총계와 늘 같은 부채와자본총계)는 새 정보가 없어
 * 계산된 행들의 맨 뒤로 내린다. 숨기지 않으므로 계정 찾기·모두 보기에는 그대로 나온다.
 */
export function orderFinancialItems(items: FinancialChangeItem[], order: FinancialTableOrder): FinancialChangeItem[] {
  return match(order)
    .with('document', 'scale', () => items)
    .with('amount', () => {
      const calculated: { item: FinancialChangeItem; size: number }[] = []
      const uncalculated: FinancialChangeItem[] = []
      for (const item of items) {
        if (item.changeAmount === null) uncalculated.push(item)
        else calculated.push({ item, size: Math.abs(item.changeAmount) })
      }
      calculated.sort((a, b) => b.size - a.size)
      const { distinct, repeated } = demoteRepeatedTotals(calculated.map((c) => c.item))
      return [...distinct, ...repeated, ...uncalculated]
    })
    .exhaustive()
}

/** 앞에 나온 행과 이전·현재 금액이 같은 '…총계' 행을 따로 뺀다(순서는 지킴) */
function demoteRepeatedTotals(sorted: FinancialChangeItem[]): {
  distinct: FinancialChangeItem[]
  repeated: FinancialChangeItem[]
} {
  const seen = new Set<string>()
  const distinct: FinancialChangeItem[] = []
  const repeated: FinancialChangeItem[] = []
  for (const item of sorted) {
    const amounts = `${item.previousAmount}|${item.currentAmount}`
    if (item.accountName.endsWith('총계') && seen.has(amounts)) repeated.push(item)
    else distinct.push(item)
    seen.add(amounts)
  }
  return { distinct, repeated }
}

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
