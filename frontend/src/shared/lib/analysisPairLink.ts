import type { CompanyAnalysisItem } from '@/shared/api/analyses'

/**
 * 전년·당해 정기보고서 접수번호 쌍에 맞는 완료된 분석을 찾는다.
 * 같은 쌍이면 전년 동기(YOY) 기준을 우선하고, 없으면 첫 일치 항목을 돌려준다.
 */
export function findMatchingAnalysis(
  completedAnalyses: readonly CompanyAnalysisItem[],
  previousRceptNo: string | null | undefined,
  currentRceptNo: string | null | undefined,
): CompanyAnalysisItem | null {
  if (!previousRceptNo || !currentRceptNo) return null
  const matches = completedAnalyses.filter(
    (item) => item.previous.rceptNo === previousRceptNo && item.current.rceptNo === currentRceptNo,
  )
  if (matches.length === 0) return null
  return matches.find((item) => item.basis === 'YOY') ?? matches[0]
}

/** 두 정기보고서의 전년 동기 비교 조건 확인 주소 */
export function compareConditionPath(corpCode: string, previousRceptNo: string, currentRceptNo: string): string {
  return `/companies/${encodeURIComponent(corpCode)}/compare?current=${encodeURIComponent(currentRceptNo)}&previous=${encodeURIComponent(previousRceptNo)}&basis=YOY`
}
