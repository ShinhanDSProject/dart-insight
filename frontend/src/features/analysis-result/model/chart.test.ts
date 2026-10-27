import { describe, expect, it } from 'vitest'
import type { FinancialChangeItem } from '@/shared/api/results'
import { chartData, formatTickRate } from './chart'

function item(changeId: number, previousAmount: number | null, currentAmount: number | null): FinancialChangeItem {
  const changeAmount = previousAmount === null || currentAmount === null ? null : currentAmount - previousAmount
  return {
    changeId,
    sjDiv: 'BS',
    accountName: `계정${changeId}`,
    accountDetail: null,
    amountBasis: 'POINT',
    previousAmount,
    currentAmount,
    changeAmount,
    changeRate: changeAmount === null || !previousAmount ? null : changeAmount / previousAmount,
    direction: null,
    calcStatus: changeAmount === null ? 'ONLY_CURRENT' : 'OK',
    calcMessage: null,
    currency: 'KRW',
  }
}

describe('chartData', () => {
  it('증감액 절댓값이 큰 순으로 고르고, 같으면 표 순서를 지킨다', () => {
    const data = chartData([item(1, 100, 110), item(2, 100, 50), item(3, 100, 90), item(4, 100, 110)], 3)
    expect(data.items.map((i) => i.changeId)).toEqual([2, 1, 3])
    expect(data.rest).toBe(1)
    expect(data.excluded).toBe(0)
  })

  it('값이 없는 계정은 0으로 그리지 않고 따로 센다', () => {
    const data = chartData([item(1, null, 5), item(2, 10, null), item(3, 10, 12)])
    expect(data.items.map((i) => i.changeId)).toEqual([3])
    expect(data.excluded).toBe(2)
    expect(data.rest).toBe(0)
  })

  it('이전 값이 0이라 증감률이 없어도 금액으로는 그린다', () => {
    const data = chartData([item(1, 0, 5)])
    expect(data.items).toHaveLength(1)
    expect(data.items[0].changeRate).toBeNull()
  })
})

describe('축 눈금 문구', () => {
  it('증감률은 부호를 붙이고 0은 부호 없이 쓴다', () => {
    expect(formatTickRate(0.5)).toBe('+50%')
    expect(formatTickRate(-0.2)).toBe('−20%')
    expect(formatTickRate(0)).toBe('0%')
  })
})
