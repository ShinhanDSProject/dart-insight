import { useCallback } from 'react'
import { match } from 'ts-pattern'
import { getFinancialChanges, type FinancialChangeItem } from '@/shared/api/results'
import { getSummary } from '@/shared/api/summary'
import { getTextChanges, type TextSectionCount } from '@/shared/api/textChanges'
import type { LoadState } from '@/shared/hooks/asyncState'
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
 * 같은 문장 변화 응답의 섹션 목록(문장 변화 탭의 섹션 선택과 같은 출처)은 입력 중 섹션 질문 제안에 쓴다(#267). 못 불러오면 빈 목록이다.
 * 그 섹션별 건수(sectionCounts)는 원문 확인 목차의 '변경 N' 배지에 쓴다(#313). 요약 개요의 막대와 같은 응답 필드라 요청을 더하지 않는다.
 */
export function useAskSuggestions(analysisId: number): {
  questions: LoadState<string[]>
  sections: string[]
  sectionCounts: TextSectionCount[]
} {
  const load = useCallback(
    async (signal: AbortSignal): Promise<{ questions: string[]; sections: string[]; sectionCounts: TextSectionCount[] }> => {
      const [summary, text] = await Promise.all([
        getSummary(analysisId, signal).catch(orNull(signal)),
        getTextChanges(analysisId, { types: [], sort: 'priority', section: null, q: null, page: 0, size: 1 }, signal).catch(
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
      return {
        questions: askSuggestions({ accounts, topSection: top ? topSectionOf(top.sectionPath) : null }),
        sections: text?.sections.map((s) => s.title) ?? [],
        sectionCounts: text?.sections ?? [],
      }
    },
    [analysisId],
  )
  const { state } = useAsync(load)
  return match(state)
    .with({ status: 'success' }, ({ data }) => ({
      questions: { status: 'success', data: data.questions } as const,
      sections: data.sections,
      sectionCounts: data.sectionCounts,
    }))
    .with({ status: 'loading' }, { status: 'error' }, (s) => ({ questions: s, sections: [], sectionCounts: [] }))
    .exhaustive()
}
