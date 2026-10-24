import { describe, expect, it } from 'vitest'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import { completedDateLabel, pastAnalysisLabel } from './pastAnalyses'

const item: CompanyAnalysisItem = {
  analysisId: 15,
  basis: 'YOY',
  previous: { rceptNo: '20250814000987', reportName: '반기보고서 (2025.06)', periodEnd: '2025-06-30' },
  current: { rceptNo: '20260814001234', reportName: '반기보고서 (2026.06)', periodEnd: '2026-06-30' },
  completedAt: '2026-10-24T15:20:31',
}

describe('이미 분석한 비교 문구', () => {
  it('두 보고서 이름, 비교 기준, 완료 월/일을 잇는다', () => {
    expect(pastAnalysisLabel(item)).toBe('반기보고서 (2025.06) → 반기보고서 (2026.06) · 전년 동기 · 10/24 완료')
  })

  it('비교 기준은 화면의 기준 이름으로 보인다', () => {
    expect(pastAnalysisLabel({ ...item, basis: 'PREV' })).toContain(' · 직전 기간 · ')
    expect(pastAnalysisLabel({ ...item, basis: 'CUSTOM' })).toContain(' · 직접 선택 · ')
  })

  it('완료 시각 형식이 다르면 완료 날짜를 빼고 보인다', () => {
    expect(completedDateLabel('언젠가')).toBe('')
    expect(pastAnalysisLabel({ ...item, completedAt: '' })).toBe('반기보고서 (2025.06) → 반기보고서 (2026.06) · 전년 동기')
  })

  it('완료 월/일은 두 자리로 보인다', () => {
    expect(completedDateLabel('2026-01-05T00:00:00')).toBe('01/05')
  })
})
