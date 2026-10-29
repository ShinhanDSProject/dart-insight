import { describe, expect, it } from 'vitest'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import type { TrendPeriod } from '@/shared/api/financialTrends'
import { trendCompareAction } from './financialTrendCompare'

function period(
  rceptNo: string,
  reportType: TrendPeriod['reportType'],
  fiscalYear: number,
  periodEnd: string,
): TrendPeriod {
  return {
    rceptNo,
    reportType,
    reportName: `보고서 (${periodEnd})`,
    fiscalYear,
    periodEnd,
    dataStatus: 'AVAILABLE',
    sourceRceptNo: rceptNo,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

function analysis(
  analysisId: number,
  prevRcept: string,
  curRcept: string,
  basis: CompanyAnalysisItem['basis'] = 'YOY',
): CompanyAnalysisItem {
  return {
    analysisId,
    basis,
    previous: { rceptNo: prevRcept, reportName: '이전 보고서', periodEnd: '2025-06-30' },
    current: { rceptNo: curRcept, reportName: '현재 보고서', periodEnd: '2026-06-30' },
    completedAt: '2026-08-20T10:00:00',
  }
}

describe('trendCompareAction (#526)', () => {
  const periods = [
    period('20240814000001', 'HALF', 2024, '2024-06-30'),
    period('20250814003156', 'HALF', 2025, '2025-06-30'),
    period('20260814003699', 'HALF', 2026, '2026-06-30'),
    period('20260515002181', 'Q1', 2026, '2026-03-31'),
  ]

  it('고른 보고서 종류의 최근 2기가 있고 완료된 분석이 없으면 비교 조건 확인(/compare?basis=YOY)으로 연결한다', () => {
    expect(trendCompareAction('00126380', 'HALF', periods, [])).toEqual({
      to: '/companies/00126380/compare?current=20260814003699&previous=20250814003156&basis=YOY',
      label: '2025 반기 → 2026 반기 비교하기',
      reused: false,
      previousRceptNo: '20250814003156',
      currentRceptNo: '20260814003699',
    })
  })

  it('같은 보고서 쌍의 완료된 분석이 이미 있으면 그 분석의 재무 탭(?tab=financial)으로 바로 연결한다', () => {
    const completed = [
      analysis(7, '20250814003156', '20260814003699', 'CUSTOM'),
      analysis(12, '20250814003156', '20260814003699', 'YOY'),
    ]
    expect(trendCompareAction('00126380', 'HALF', periods, completed)).toEqual({
      to: '/analyses/12?tab=financial',
      label: '2025 반기 → 2026 반기 비교 결과 보기',
      reused: true,
      previousRceptNo: '20250814003156',
      currentRceptNo: '20260814003699',
    })
  })

  it('직전 연도(fiscalYear - 1) 동종 보고서가 없으면(한 기간뿐이거나 해가 건너뜀) null을 돌려준다', () => {
    expect(trendCompareAction('00126380', 'Q1', periods, [])).toBeNull()
    expect(trendCompareAction('00126380', 'ANNUAL', periods, [])).toBeNull()
    const skippedYear = [
      period('20240314000001', 'ANNUAL', 2023, '2023-12-31'),
      period('20260314000001', 'ANNUAL', 2025, '2025-12-31'),
    ]
    expect(trendCompareAction('00126380', 'ANNUAL', skippedYear, [])).toBeNull()
  })
})
