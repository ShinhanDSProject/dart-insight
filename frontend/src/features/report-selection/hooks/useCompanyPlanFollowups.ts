import { useCallback } from 'react'
import { getCompanyPlanFollowups } from '@/shared/api/planFollowups'
import { useAsync } from '@/shared/hooks/useAsync'

/** 약속과 실제 대조(FS-60). 기업이 바뀌거나 화면을 떠나면 이전 요청을 취소한다 */
export function useCompanyPlanFollowups(corpCode: string) {
  const load = useCallback((signal: AbortSignal) => getCompanyPlanFollowups(corpCode, signal), [corpCode])
  return useAsync(load)
}
