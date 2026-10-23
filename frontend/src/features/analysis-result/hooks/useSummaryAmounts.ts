import { useCallback } from 'react'
import { getFinancialChanges, type SjDiv } from '@/shared/api/results'
import { useAsync } from '@/shared/hooks/useAsync'
import { amountsById } from '../model/summaryAmounts'

/**
 * 요약 카드의 이전·현재 비교 막대(FS-3 R10)에 쓸 금액. 요약 응답에는 금액이 없어 재무제표별 변화 목록에서 찾는다.
 * 못 불러오면 막대만 빠지고 사실 문장은 그대로다.
 */
export function useSummaryAmounts(analysisId: number, sjDivs: SjDiv[]) {
  const key = sjDivs.join(',')
  const load = useCallback(
    (signal: AbortSignal) =>
      Promise.all(
        key.split(',').map((sjDiv) => getFinancialChanges(analysisId, sjDiv as SjDiv, true, signal)),
      ).then((lists) => amountsById(lists.flatMap((list) => list.items))),
    [analysisId, key],
  )
  return useAsync(key === '' ? null : load)
}
