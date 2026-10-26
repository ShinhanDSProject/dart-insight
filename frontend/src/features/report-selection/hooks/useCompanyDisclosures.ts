import { useCallback } from 'react'
import { listDisclosures } from '@/shared/api/disclosures'
import { useAsync } from '@/shared/hooks/useAsync'

/**
 * 기업의 최근 공시(기본 90일, #332). 묶음 거르기는 받은 목록 안에서 화면이 한다(건수는 서버가 기간 전체로 셈).
 * 기업이 바뀌거나 화면을 떠나면 이전 요청을 취소한다
 */
export function useCompanyDisclosures(corpCode: string) {
  const load = useCallback((signal: AbortSignal) => listDisclosures(corpCode, signal), [corpCode])
  return useAsync(load)
}
