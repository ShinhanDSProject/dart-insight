import { describe, expect, it } from 'vitest'
import type { FinancialChangeItem } from '@/shared/api/results'
import { barSpan, chartData, formatCompactAmount, formatTickRate, niceScale, position } from './chart'

function item(changeId: number, previousAmount: number | null, currentAmount: number | null): FinancialChangeItem {
  const changeAmount = previousAmount === null || currentAmount === null ? null : currentAmount - previousAmount
  return {
    changeId,
    sjDiv: 'BS',
    accountName: `계정${changeId}`,
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

describe('niceScale', () => {
  it('0을 늘 담고 축 끝을 눈금 간격에 맞춘다', () => {
    expect(niceScale([0.153, 0.928])).toEqual({ min: 0, max: 1, ticks: [0, 0.5, 1] })
    expect(niceScale([0.1, 0.7])).toEqual({ min: 0, max: 0.8, ticks: [0, 0.2, 0.4, 0.6, 0.8] })
    expect(niceScale([-0.32, 2.43])).toEqual({ min: -1, max: 3, ticks: [-1, 0, 1, 2, 3] })
  })

  it('값이 모두 0이면 0~1 축을 쓴다', () => {
    expect(niceScale([0, 0])).toEqual({ min: 0, max: 1, ticks: [0, 1] })
  })
})

describe('막대 위치', () => {
  const scale = { min: -1, max: 3, ticks: [] }

  it('0에서 값까지 막대를 그린다', () => {
    expect(position(scale, 0)).toBe(25)
    expect(barSpan(scale, 1)).toEqual({ left: 25, width: 25 })
    expect(barSpan(scale, -0.5)).toEqual({ left: 12.5, width: 12.5 })
  })
})

describe('축 눈금 문구', () => {
  it('금액은 조·억으로 줄이고, 원화가 아니면 통화를 붙인다', () => {
    expect(formatCompactAmount(759_480_516_000_000, 'KRW')).toBe('759.5조')
    expect(formatCompactAmount(-371_772_500_000, 'KRW')).toBe('−3717.7억')
    expect(formatCompactAmount(2_000_000, 'USD')).toBe('200만 USD')
  })

  it('증감률은 부호를 붙이고 0은 부호 없이 쓴다', () => {
    expect(formatTickRate(0.5)).toBe('+50%')
    expect(formatTickRate(-0.2)).toBe('−20%')
    expect(formatTickRate(0)).toBe('0%')
  })
})
