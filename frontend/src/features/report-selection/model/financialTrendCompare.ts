import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import type { TrendPeriod } from '@/shared/api/financialTrends'
import type { ReportType } from '@/shared/api/reports'
import { periodShortLabel } from './financialTrend'
import { compareConditionPath, findMatchingAnalysis, type ActionLink } from './overviewAnalysisLink'

export interface TrendCompareAction extends ActionLink {
  reused: boolean
  previousRceptNo: string
  currentRceptNo: string
}

function comparePeriodDesc(a: TrendPeriod, b: TrendPeriod): number {
  if (a.fiscalYear !== b.fiscalYear) return b.fiscalYear - a.fiscalYear
  if (a.periodEnd !== b.periodEnd) return b.periodEnd.localeCompare(a.periodEnd)
  return b.rceptNo.localeCompare(a.rceptNo)
}

/**
 * 주요 재무 흐름에서 고른 보고서 종류의 가장 최근 기간과 직전 연도(fiscalYear - 1) 동종 보고서가 모두 있으면
 * 전년 동기(YOY) 심층 비교 연결을 만든다(#526).
 * 완료된 분석이 이미 있으면 재무 탭(?tab=financial)으로, 아직 없으면 비교 조건 확인(/compare)으로 연결한다.
 */
export function trendCompareAction(
  corpCode: string,
  type: ReportType,
  periods: readonly TrendPeriod[],
  completedAnalyses: readonly CompanyAnalysisItem[],
): TrendCompareAction | null {
  const ofType = periods.filter((p) => p.reportType === type).slice().sort(comparePeriodDesc)
  const current = ofType[0]
  if (!current) return null

  const previous = ofType.find(
    (p) => p.fiscalYear === current.fiscalYear - 1 && p.rceptNo !== current.rceptNo,
  )
  if (!previous) return null

  const pairText = `${periodShortLabel(previous)} → ${periodShortLabel(current)}`
  const matched = findMatchingAnalysis(completedAnalyses, previous.rceptNo, current.rceptNo)
  if (matched !== null) {
    return {
      to: `/analyses/${matched.analysisId}?tab=financial`,
      label: `${pairText} 비교 결과 보기`,
      reused: true,
      previousRceptNo: previous.rceptNo,
      currentRceptNo: current.rceptNo,
    }
  }

  return {
    to: compareConditionPath(corpCode, previous.rceptNo, current.rceptNo),
    label: `${pairText} 비교하기`,
    reused: false,
    previousRceptNo: previous.rceptNo,
    currentRceptNo: current.rceptNo,
  }
}
