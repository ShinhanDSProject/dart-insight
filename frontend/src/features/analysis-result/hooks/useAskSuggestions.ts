import { useCallback } from 'react'
import { getFinancialChanges, type FinancialChangeItem } from '@/shared/api/results'
import { getSummary } from '@/shared/api/summary'
import { getTextChanges } from '@/shared/api/textChanges'
import { useAsync } from '@/shared/hooks/useAsync'
import { askSuggestions, topSectionOf, type SuggestionAccount } from '../model/askQuestion'
import { amountsById, summarySjDivs } from '../model/summaryAmounts'

/** 취소가 아닌 실패는 그 자료만 빼고(null) 나머지로 만든다 */
const orNull =
  (signal: AbortSignal) =>
  (error: unknown): null => {
    if (signal.aborted) throw error
    return null
  }

/**
 * AI 질문의 예시 질문(3.10). 요약의 재무 항목(계정 이름·증감 방향은 재무 수치 목록에서)과 중요도가 가장 높은 문장 변경의 섹션으로 만든다.
 * 어느 자료를 못 불러와도 '새로 생긴 위험 요인' 질문은 늘 남는다. 언마운트하면 요청을 취소한다(ST-5).
 */
export function useAskSuggestions(analysisId: number) {
  const load = useCallback(
    async (signal: AbortSignal): Promise<string[]> => {
      const [summary, text] = await Promise.all([
        getSummary(analysisId, signal).catch(orNull(signal)),
        getTextChanges(analysisId, { type: null, sort: 'priority', section: null, q: null, page: 0, size: 1 }, signal).catch(
          orNull(signal),
        ),
      ])
      const items = summary?.items ?? []
      const sjDivs = summarySjDivs(items)
      const amounts =
        sjDivs.length === 0
          ? null
          : await Promise.all(sjDivs.map((sj) => getFinancialChanges(analysisId, sj, true, signal)))
              .then((lists) => amountsById(lists.flatMap((list) => list.items)))
              .catch(orNull(signal))
      const accounts: SuggestionAccount[] = items
        .filter((item) => item.kind === 'FINANCIAL' && item.target.changeId !== null)
        .map((item) => (item.target.changeId === null ? undefined : amounts?.get(item.target.changeId)))
        .filter((a): a is FinancialChangeItem => a !== undefined)
      const top = text?.items[0]
      return askSuggestions({ accounts, topSection: top ? topSectionOf(top.sectionPath) : null })
    },
    [analysisId],
  )
  return useAsync(load)
}
