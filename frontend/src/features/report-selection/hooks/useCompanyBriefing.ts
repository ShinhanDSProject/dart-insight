import { useCallback } from 'react'
import { getCompanyBriefing } from '@/shared/api/briefing'
import { useAsync } from '@/shared/hooks/useAsync'

/** 기업 브리핑(FS-49). 기업이 바뀌거나 화면을 떠나면 이전 요청을 취소한다 */
export function useCompanyBriefing(corpCode: string) {
  const load = useCallback((signal: AbortSignal) => getCompanyBriefing(corpCode, signal), [corpCode])
  return useAsync(load)
}
