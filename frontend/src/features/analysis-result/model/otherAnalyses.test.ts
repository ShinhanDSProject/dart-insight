import { describe, expect, it } from 'vitest'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import { OTHER_ANALYSES_REQUEST_LIMIT, otherAnalysisLinks } from './otherAnalyses'

function item(analysisId: number): CompanyAnalysisItem {
  return {
    analysisId,
    basis: 'YOY',
    previous: { rceptNo: '20250814000987', reportName: '반기보고서 (2025.06)', periodEnd: '2025-06-30' },
    current: { rceptNo: '20260814001234', reportName: '반기보고서 (2026.06)', periodEnd: '2026-06-30' },
    completedAt: '2026-10-24T15:20:31',
  }
}

describe('이 기업의 다른 분석 링크', () => {
  it('지금 보는 분석은 빼고 나머지를 순서대로 보인다', () => {
    const links = otherAnalysisLinks([item(15), item(14), item(13)], 14, 'summary')
    expect(links.map((l) => l.analysisId)).toEqual([15, 13])
  })

  it('링크는 그 분석 결과의 지금 탭으로 간다', () => {
    const [link] = otherAnalysisLinks([item(15)], 14, 'financial')
    expect(link.to).toBe('/analyses/15?tab=financial')
    expect(link.label).toBe('반기보고서 (2025.06) → 반기보고서 (2026.06) · 전년 동기 · 10/24 완료')
  })

  it('최대 5개까지 보인다', () => {
    const items = [20, 19, 18, 17, 16, 15].map(item)
    expect(otherAnalysisLinks(items, 1, 'text')).toHaveLength(5)
  })

  it('지금 분석이 목록에 있어도 5개를 채울 수 있게 6개를 요청한다', () => {
    expect(OTHER_ANALYSES_REQUEST_LIMIT).toBe(6)
    const items = [20, 19, 18, 17, 16, 15].map(item)
    expect(otherAnalysisLinks(items, 18, 'text').map((l) => l.analysisId)).toEqual([20, 19, 17, 16, 15])
  })

  it('지금 분석만 있으면 빈 목록이다', () => {
    expect(otherAnalysisLinks([item(14)], 14, 'summary')).toEqual([])
  })
})
