import { describe, expect, it } from 'vitest'
import type { ChangeScale } from '@/shared/api/results'
import { formatScaleRatio, scaleBaseName, scaleLine, scaleReasonMessage, shortScaleReason } from './changeScale'

function scale(overrides: Partial<ChangeScale> = {}): ChangeScale {
  return { base: 'REVENUE', baseAccountName: '매출액', baseAmount: 1_000, ratio: 0.012, reason: null, ...overrides }
}

describe('formatScaleRatio', () => {
  it('퍼센트 소수 1자리에 부호를 붙인다', () => {
    expect(formatScaleRatio(0.012)).toBe('+1.2%')
    expect(formatScaleRatio(-0.0456)).toBe('−4.6%')
    expect(formatScaleRatio(1.5)).toBe('+150.0%')
  })

  it('0은 0.0%, 0이 아닌데 0.1%에 못 미치면 부호와 함께 0.1% 미만이다', () => {
    expect(formatScaleRatio(0)).toBe('0.0%')
    expect(formatScaleRatio(0.0004)).toBe('+0.1% 미만')
    expect(formatScaleRatio(-0.000001)).toBe('−0.1% 미만')
  })
})

describe('scaleLine', () => {
  it('비율이 있으면 기준 계정 이름(원문 그대로) 대비 비율을 보인다', () => {
    expect(scaleLine(scale())).toBe('매출액 대비 +1.2%')
    expect(scaleLine(scale({ baseAccountName: '영업수익', ratio: -0.3 }))).toBe('영업수익 대비 −30.0%')
    expect(scaleLine(scale({ base: 'TOTAL_ASSETS', baseAccountName: '자산총계', ratio: 0.05 }))).toBe('자산총계 대비 +5.0%')
  })

  it('기준 값이 없거나 0 이하면 비율 없이 짧은 사유를 보인다', () => {
    expect(scaleLine(scale({ ratio: null, reason: 'BASE_NOT_FOUND', baseAccountName: null }))).toBe('매출액 대비 · 매출액 확인 안 됨')
    expect(scaleLine(scale({ ratio: null, reason: 'BASE_MISSING' }))).toBe('매출액 대비 · 매출액 값 없음')
    expect(scaleLine(scale({ base: 'TOTAL_EQUITY', ratio: null, reason: 'BASE_NOT_POSITIVE' }))).toBe('자본총계 대비 · 자본총계 0 이하')
  })

  it('증감액이 없으면 표에 이미 사유가 있어 보조 줄을 두지 않는다', () => {
    expect(scaleLine(scale({ ratio: null, reason: 'CHANGE_NOT_CALCULATED' }))).toBeNull()
  })
})

describe('기준 이름과 사유 문장', () => {
  it('기준 계정 이름이 없으면 기준 종류 이름을 쓴다', () => {
    expect(scaleBaseName({ base: 'TOTAL_ASSETS', baseAccountName: null })).toBe('자산총계')
    expect(scaleBaseName({ base: 'REVENUE', baseAccountName: '수익(매출액)' })).toBe('수익(매출액)')
  })

  it('사유마다 짧은 말과 문장이 있다', () => {
    expect(shortScaleReason('CHANGE_NOT_CALCULATED', 'REVENUE')).toBe('증감액 없음')
    expect(scaleReasonMessage('BASE_NOT_POSITIVE', 'TOTAL_ASSETS')).toBe(
      '기준 계정(자산총계)의 현재 값이 0 이하라 비율을 계산하지 않았어요.',
    )
  })
})
