import { describe, expect, it } from 'vitest'
import { excludedNote, parseSeasonValue, seasonCaption, seasonName, seasonOptionLabel, seasonValue } from './seasonChanges'

describe('seasonChanges', () => {
  it('시즌을 짧은 이름과 고르기 이름으로 적는다', () => {
    expect(seasonName('HALF', 2026)).toBe('2026 반기')
    expect(seasonName('ANNUAL', 2025)).toBe('2025 사업보고서')
    expect(seasonOptionLabel({ reportType: 'HALF', fiscalYear: 2026 })).toBe('2026 반기보고서')
  })

  it('비교 기간과 대상 수를 머리말로 적는다', () => {
    expect(seasonCaption('HALF', 2026, 2025, 100)).toBe('2026 반기 vs 2025 반기 · 대표 기업 100곳 대상')
  })

  it('고르기 값과 시즌을 서로 바꾸고, 없는 값이면 null이다', () => {
    const seasons = [{ reportType: 'HALF' as const, fiscalYear: 2026 }, { reportType: 'Q1' as const, fiscalYear: 2026 }]
    expect(seasonValue(seasons[1])).toBe('Q1-2026')
    expect(parseSeasonValue('Q1-2026', seasons)).toEqual(seasons[1])
    expect(parseSeasonValue('Q3-2026', seasons)).toBeNull()
  })

  it('빠진 기업을 사유별로 알리고, 없으면 알리지 않는다', () => {
    expect(excludedNote({ noReport: 4, failed: 2 })).toBe('보고서가 아직 없는 4곳, 원문을 비교하지 못한 2곳은 순위에서 뺐어요.')
    expect(excludedNote({ noReport: 0, failed: 1 })).toBe('원문을 비교하지 못한 1곳은 순위에서 뺐어요.')
    expect(excludedNote({ noReport: 0, failed: 0 })).toBeNull()
  })
})
