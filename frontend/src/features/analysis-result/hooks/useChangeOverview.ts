import { useCallback } from 'react'
import { getFinancialChanges } from '@/shared/api/results'
import { getTextChanges } from '@/shared/api/textChanges'
import { useAsync } from '@/shared/hooks/useAsync'
import { financialOverview, textOverview } from '../model/overview'

/**
 * 요약 탭의 변화 개요(FS-4 R6). 재무 수치(statements)와 문장 변화(counts)를 따로 불러와
 * 한쪽이 실패해도 다른 쪽 숫자는 보인다. 언마운트하면 요청을 취소한다(useAsync, ST-5).
 */
export function useChangeOverview(analysisId: number) {
  // 개수만 쓰므로 계정은 '변경 항목만', 문장은 한 건만 받는다
  const loadFinancial = useCallback(
    (signal: AbortSignal) => getFinancialChanges(analysisId, 'BS', true, signal).then((r) => financialOverview(r.statements)),
    [analysisId],
  )
  const loadText = useCallback(
    (signal: AbortSignal) =>
      getTextChanges(analysisId, { types: [], sort: 'priority', section: null, q: null, page: 0, size: 1 }, signal).then(textOverview),
    [analysisId],
  )
  return { financial: useAsync(loadFinancial), text: useAsync(loadText) }
}
