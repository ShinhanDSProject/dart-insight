import { useCallback } from 'react'
import { getFinancialChanges, type SjDiv } from '@/shared/api/results'
import { getTextChanges } from '@/shared/api/textChanges'
import { useAsync } from '@/shared/hooks/useAsync'

/** 한 쪽에 보이는 문장 변경 후보 수 */
export const TEXT_CANDIDATE_SIZE = 20

/**
 * 글에 붙일 문장 변경 후보(#464). 중요도 순으로 쪽(page, 0부터)을 나누고, 검색어(2~100자)가 있으면 그것으로 찾는다.
 * analysisId가 null이면(분석을 고르지 않았거나 재무를 보는 중) 부르지 않는다. 조건이 바뀌면 이전 요청을 취소한다.
 */
export function useTextCandidates(analysisId: number | null, q: string | null, page: number) {
  const load = useCallback(
    (signal: AbortSignal) =>
      getTextChanges(
        analysisId as number,
        { types: [], sort: 'priority', section: null, q, page, size: TEXT_CANDIDATE_SIZE },
        signal,
      ),
    [analysisId, q, page],
  )
  return useAsync(analysisId === null ? null : load)
}

/** 글에 붙일 재무 계정 후보(#464). 고른 재무제표에서 바뀐 계정만. analysisId가 null이면 부르지 않는다 */
export function useFinancialCandidates(analysisId: number | null, sjDiv: SjDiv) {
  const load = useCallback(
    (signal: AbortSignal) => getFinancialChanges(analysisId as number, sjDiv, true, signal),
    [analysisId, sjDiv],
  )
  return useAsync(analysisId === null ? null : load)
}
