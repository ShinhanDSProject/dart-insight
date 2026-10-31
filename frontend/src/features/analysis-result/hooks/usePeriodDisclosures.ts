import { useCallback } from 'react'
import type { Analysis } from '@/shared/api/analyses'
import { listDisclosures } from '@/shared/api/disclosures'
import { useAsync } from '@/shared/hooks/useAsync'
import { summarizePeriodDisclosures } from '../model/periodDisclosures'

/** 공시 목록 API가 받을 수 있는 가장 긴 기간(일). 기업 개요의 공시 타임라인과 같은 저장 목록을 쓴다 */
const DISCLOSURE_DAYS = 365

/**
 * 두 보고서 사이 수시공시 요약(시안 '이 기간 수시공시'). 기업의 최근 1년 공시(GET /api/companies/{corpCode}/disclosures?days=365)를
 * 받아 화면이 기간으로 거른다. 새 API를 만들지 않는다. 분석이 바뀌거나 화면을 떠나면 이전 요청을 취소한다.
 */
export function usePeriodDisclosures(analysis: Analysis) {
  const { corpCode } = analysis
  const previous = analysis.previous.receivedAt
  const current = analysis.current.receivedAt
  const load = useCallback(
    (signal: AbortSignal) =>
      listDisclosures(corpCode, signal, DISCLOSURE_DAYS).then((list) => summarizePeriodDisclosures(list, previous, current)),
    [corpCode, previous, current],
  )
  return useAsync(load)
}
