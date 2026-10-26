import { useCallback } from 'react'
import { getCompanyOverview } from '@/shared/api/companies'
import { useAsync } from '@/shared/hooks/useAsync'

/** 기업 개황(FS-45). 기업이 바뀌거나 화면을 떠나면 이전 요청을 취소한다(useAsync, ST-5) */
export function useCompanyOverview(corpCode: string) {
  const load = useCallback((signal: AbortSignal) => getCompanyOverview(corpCode, signal), [corpCode])
  return useAsync(load)
}
