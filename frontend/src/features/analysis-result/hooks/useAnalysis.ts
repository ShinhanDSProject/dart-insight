import { useCallback } from 'react'
import { getAnalysis } from '@/shared/api/analyses'
import { useAsync } from '@/shared/hooks/useAsync'

/** 결과 화면이 보여 줄 분석 한 건 */
export function useAnalysis(analysisId: string) {
  const load = useCallback((signal: AbortSignal) => getAnalysis(analysisId, signal), [analysisId])
  return useAsync(load)
}
