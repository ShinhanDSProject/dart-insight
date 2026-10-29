import { useCallback } from 'react'
import { listCompanyAnalyses, type CompanyAnalysisItem } from '@/shared/api/analyses'
import { useAsync } from '@/shared/hooks/useAsync'

const EMPTY_ITEMS: readonly CompanyAnalysisItem[] = []

/**
 * 기업의 완료된 분석 목록 조회(최대 20건, FS-60/FS-62 후속 #513).
 * 로딩 중이거나 오류 발생 시 빈 배열로 안전하게 폴백한다.
 */
export function useCompletedPairAnalyses(corpCode: string): readonly CompanyAnalysisItem[] {
  const load = useCallback((signal: AbortSignal) => listCompanyAnalyses(corpCode, signal, 20), [corpCode])
  const { state } = useAsync(load)
  return state.status === 'success' ? state.data.items : EMPTY_ITEMS
}
