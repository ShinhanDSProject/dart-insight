import { describe, expect, it } from 'vitest'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import { compareConditionPath, findMatchingAnalysis } from './analysisPairLink'

function analysis(
  analysisId: number,
  previousRceptNo: string,
  currentRceptNo: string,
  basis: CompanyAnalysisItem['basis'] = 'YOY',
): CompanyAnalysisItem {
  return {
    analysisId,
    basis,
    previous: { rceptNo: previousRceptNo, reportName: '사업보고서 (2024.12)', periodEnd: '2024-12-31' },
    current: { rceptNo: currentRceptNo, reportName: '사업보고서 (2025.12)', periodEnd: '2025-12-31' },
    completedAt: '2026-10-20T10:00:00',
  }
}

describe('완료 분석 쌍 매칭과 비교 조건 주소', () => {
  it('전년·당해 접수번호 쌍이 같은 완료 분석을 찾고 YOY 기준을 우선한다', () => {
    const items = [
      analysis(10, '20250310000001', '20260310000001', 'CUSTOM'),
      analysis(11, '20250310000001', '20260310000001', 'YOY'),
    ]
    expect(findMatchingAnalysis(items, '20250310000001', '20260310000001')?.analysisId).toBe(11)
    expect(findMatchingAnalysis([items[0]], '20250310000001', '20260310000001')?.analysisId).toBe(10)
  })

  it('접수번호가 비었거나 쌍이 맞지 않으면 null을 돌려준다', () => {
    const items = [analysis(11, '20250310000001', '20260310000001')]
    expect(findMatchingAnalysis(items, null, '20260310000001')).toBeNull()
    expect(findMatchingAnalysis(items, '20250310000001', undefined)).toBeNull()
    expect(findMatchingAnalysis(items, '20240310000001', '20260310000001')).toBeNull()
  })

  it('두 정기보고서 접수번호로 YOY 비교 조건 확인 주소를 만든다', () => {
    expect(compareConditionPath('00126380', '20250310000001', '20260310000001')).toBe(
      '/companies/00126380/compare?current=20260310000001&previous=20250310000001&basis=YOY',
    )
  })
})
