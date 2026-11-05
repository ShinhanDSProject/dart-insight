import { describe, expect, it } from 'vitest'
import { seasonCaption, seasonName } from './seasonChanges'

describe('seasonChanges', () => {
  it('시즌을 짧은 이름으로 적는다', () => {
    expect(seasonName('HALF', 2026)).toBe('2026 반기')
    expect(seasonName('ANNUAL', 2025)).toBe('2025 사업보고서')
  })

  it('비교 기간과 대상 수를 머리말로 적는다', () => {
    expect(seasonCaption('HALF', 2026, 2025, 100)).toBe('2026 반기 vs 2025 반기 · 대표 기업 100곳 대상')
  })
})
