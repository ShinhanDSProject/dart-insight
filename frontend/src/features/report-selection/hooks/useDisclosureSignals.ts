import { useCallback } from 'react'
import { getDisclosureSignals } from '@/shared/api/disclosureSignals'
import { useAsync } from '@/shared/hooks/useAsync'

/** 최근 1년 확인해 볼 공시(FS-55, #411). 기업이 바뀌거나 다시 시도하면 이전 요청을 취소한다(useAsync) */
export function useDisclosureSignals(corpCode: string) {
  const load = useCallback((signal: AbortSignal) => getDisclosureSignals(corpCode, signal), [corpCode])
  return useAsync(load)
}
