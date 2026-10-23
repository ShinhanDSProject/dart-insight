import { describe, expect, it } from 'vitest'
import { parseBasis } from './comparisonBasis'

describe('comparisonBasis', () => {
  it('비교 기준이 없거나 모르는 값이면 기본값(전년 동기)', () => {
    expect(parseBasis(null)).toBe('YOY')
    expect(parseBasis('QOQ')).toBe('YOY')
    expect(parseBasis('PREV')).toBe('PREV')
    expect(parseBasis('CUSTOM')).toBe('CUSTOM')
  })
})
