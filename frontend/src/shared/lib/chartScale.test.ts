import { describe, expect, it } from 'vitest'
import { barSpan, formatCompactAmount, niceScale, position } from './chartScale'

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
})
