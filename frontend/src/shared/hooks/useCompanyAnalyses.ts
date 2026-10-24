import { useCallback } from 'react'
import { listCompanyAnalyses } from '@/shared/api/analyses'
import { useAsync } from '@/shared/hooks/useAsync'
import { PAST_ANALYSES_LIMIT } from '@/shared/lib/pastAnalyses'

/**
 * 이 기업의 이미 분석한 비교(최근 완료 순). 기업 화면(#288)과 결과 화면(#290)이 같이 쓴다.
 * 기업이 바뀌거나 화면을 떠나면 이전 요청을 취소한다
 */
export function useCompanyAnalyses(corpCode: string, limit: number = PAST_ANALYSES_LIMIT) {
  const load = useCallback(
    (signal: AbortSignal) => listCompanyAnalyses(corpCode, signal, limit),
    [corpCode, limit],
  )
  return useAsync(load)
}
