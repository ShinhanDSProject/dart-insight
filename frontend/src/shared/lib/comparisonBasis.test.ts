import { describe, expect, it } from 'vitest'
import { basisHint, parseBasis } from './comparisonBasis'

describe('comparisonBasis', () => {
  it('비교 기준이 없거나 모르는 값이면 기본값(전년 동기)', () => {
    expect(parseBasis(null)).toBe('YOY')
    expect(parseBasis('QOQ')).toBe('YOY')
    expect(parseBasis('PREV')).toBe('PREV')
    expect(parseBasis('CUSTOM')).toBe('CUSTOM')
  })
})

describe('basisHint', () => {
  it('고른 비교 기준을 설명한다', () => {
    expect(basisHint('YOY')).toContain('작년 같은 기간')
    expect(basisHint('PREV')).toContain('바로 앞 정기보고서')
    expect(basisHint('CUSTOM')).toContain('목록에서 골라요')
  })
})
