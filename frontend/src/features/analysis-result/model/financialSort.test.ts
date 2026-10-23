import { describe, expect, it } from 'vitest'
import type { FinancialChangeItem } from '@/shared/api/results'
import { ariaSortOf, nextFinancialSort, originalOrder, sortFinancialItems } from './financialSort'

function item(changeId: number, changeAmount: number | null, changeRate: number | null): FinancialChangeItem {
  return {
    changeId,
    sjDiv: 'BS',
    accountName: `계정${changeId}`,
    amountBasis: 'POINT',
    previousAmount: changeAmount === null ? null : 100,
    currentAmount: changeAmount === null ? 5 : 100 + changeAmount,
    changeAmount,
    changeRate,
    direction: null,
    calcStatus: changeAmount === null ? 'ONLY_CURRENT' : 'OK',
    calcMessage: null,
    currency: 'KRW',
  }
}

const ids = (items: FinancialChangeItem[]) => items.map((i) => i.changeId)

describe('nextFinancialSort', () => {
  it('같은 머리글을 누르면 내림차순, 오름차순, 원문 순서로 돈다', () => {
    const first = nextFinancialSort(originalOrder, 'changeRate')
    expect(first).toEqual({ by: 'changeRate', direction: 'descending' })
    const second = nextFinancialSort(first, 'changeRate')
    expect(second).toEqual({ by: 'changeRate', direction: 'ascending' })
    expect(nextFinancialSort(second, 'changeRate')).toEqual(originalOrder)
  })

  it('다른 머리글을 누르면 그 열의 내림차순부터 시작한다', () => {
    expect(nextFinancialSort({ by: 'changeAmount', direction: 'ascending' }, 'changeRate')).toEqual({
      by: 'changeRate',
      direction: 'descending',
    })
  })
})

describe('ariaSortOf', () => {
  it('정렬 중인 열만 방향을 알리고 나머지는 none이다', () => {
    const sort = { by: 'changeAmount', direction: 'ascending' } as const
    expect(ariaSortOf(sort, 'changeAmount')).toBe('ascending')
    expect(ariaSortOf(sort, 'changeRate')).toBe('none')
    expect(ariaSortOf(originalOrder, 'changeRate')).toBe('none')
  })
})

describe('sortFinancialItems', () => {
  const items = [
    item(1, 10, 0.1),
    item(2, null, null),
    item(3, -30, -0.3),
    item(4, 50, null),
    item(5, 20, 0.5),
    item(6, null, null),
  ]

  it('원문 순서면 받은 순서 그대로 둔다', () => {
    expect(ids(sortFinancialItems(items, originalOrder))).toEqual([1, 2, 3, 4, 5, 6])
  })

  it('증감률 내림차순으로 정렬하고 증감률을 계산하지 못한 행은 원래 순서대로 맨 아래에 둔다', () => {
    expect(ids(sortFinancialItems(items, { by: 'changeRate', direction: 'descending' }))).toEqual([5, 1, 3, 2, 4, 6])
  })

  it('오름차순에서도 계산하지 못한 행은 맨 아래에 남는다', () => {
    expect(ids(sortFinancialItems(items, { by: 'changeRate', direction: 'ascending' }))).toEqual([3, 1, 5, 2, 4, 6])
  })

  it('증감액 정렬은 증감률이 없어도 증감액이 있으면 함께 정렬한다', () => {
    expect(ids(sortFinancialItems(items, { by: 'changeAmount', direction: 'descending' }))).toEqual([4, 5, 1, 3, 2, 6])
    expect(ids(sortFinancialItems(items, { by: 'changeAmount', direction: 'ascending' }))).toEqual([3, 1, 5, 4, 2, 6])
  })

  it('값이 같으면 원래 순서를 지키고 원래 배열은 바꾸지 않는다', () => {
    const same = [item(1, 10, 0.1), item(2, 10, 0.1), item(3, 10, 0.1)]
    expect(ids(sortFinancialItems(same, { by: 'changeAmount', direction: 'descending' }))).toEqual([1, 2, 3])
    sortFinancialItems(items, { by: 'changeRate', direction: 'ascending' })
    expect(ids(items)).toEqual([1, 2, 3, 4, 5, 6])
  })
})
