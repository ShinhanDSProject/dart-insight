import { useCallback } from 'react'
import { getSummary } from '@/shared/api/summary'
import { useAsync } from '@/shared/hooks/useAsync'

/** 요약·설명(3.2) */
export function useSummary(analysisId: number) {
  const load = useCallback((signal: AbortSignal) => getSummary(analysisId, signal), [analysisId])
  return useAsync(load)
}
