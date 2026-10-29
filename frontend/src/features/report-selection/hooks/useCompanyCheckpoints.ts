import { useCallback } from 'react'
import { getCompanyCheckpoints } from '@/shared/api/checkpoints'
import { useAsync } from '@/shared/hooks/useAsync'

/** 재무 체크 포인트(FS-62, #479). 기업이 바뀌거나 다시 시도하면 이전 요청을 취소한다(useAsync) */
export function useCompanyCheckpoints(corpCode: string) {
  const load = useCallback((signal: AbortSignal) => getCompanyCheckpoints(corpCode, signal), [corpCode])
  return useAsync(load)
}
