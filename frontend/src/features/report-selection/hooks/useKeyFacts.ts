import { useCallback } from 'react'
import { getKeyFacts } from '@/shared/api/keyFacts'
import { useAsync } from '@/shared/hooks/useAsync'

/** 최신 정기보고서와 1년 전 같은 종류 보고서의 최대주주·임원·배당(#331) */
export function useKeyFacts(corpCode: string) {
  const load = useCallback((signal: AbortSignal) => getKeyFacts(corpCode, signal), [corpCode])
  return useAsync(load)
}
