import { useCallback } from 'react'
import { getCompanyOutlook } from '@/shared/api/outlook'
import { useAsync } from '@/shared/hooks/useAsync'

/** 회사가 밝힌 전망·계획(FS-59). 기업이 바뀌거나 화면을 떠나면 이전 요청을 취소한다 */
export function useCompanyOutlook(corpCode: string) {
  const load = useCallback((signal: AbortSignal) => getCompanyOutlook(corpCode, signal), [corpCode])
  return useAsync(load)
}
