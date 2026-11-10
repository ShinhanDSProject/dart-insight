import { useCallback } from 'react'
import { getPeriodActivities } from '@/shared/api/activities'
import { useAsync } from '@/shared/hooks/useAsync'

/** 두 보고서 사이 활동과 앞으로의 영향(ADR-0067). 분석이 바뀌거나 화면을 떠나면 이전 요청을 취소한다 */
export function usePeriodActivities(analysisId: number) {
  const load = useCallback((signal: AbortSignal) => getPeriodActivities(analysisId, signal), [analysisId])
  return useAsync(load)
}
