import { useCallback } from 'react'
import { listCompanyAnalyses } from '@/shared/api/analyses'
import { useAsync } from '@/shared/hooks/useAsync'
import { PAST_ANALYSES_LIMIT } from '../model/pastAnalyses'

/** 이 기업의 이미 분석한 비교(최근 완료 순). 기업이 바뀌거나 화면을 떠나면 이전 요청을 취소한다 */
export function useCompanyAnalyses(corpCode: string) {
  const load = useCallback(
    (signal: AbortSignal) => listCompanyAnalyses(corpCode, signal, PAST_ANALYSES_LIMIT),
    [corpCode],
  )
  return useAsync(load)
}
