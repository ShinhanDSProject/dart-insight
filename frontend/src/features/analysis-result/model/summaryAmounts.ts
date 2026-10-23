import type { FinancialChangeItem, SjDiv } from '@/shared/api/results'
import type { SummaryItem } from '@/shared/api/summary'

/** 요약의 재무 항목이 가리키는 재무제표들(겹치지 않게, 정렬). 비교 막대에 쓸 금액을 재무제표별로 한 번씩 받는다 */
export function summarySjDivs(items: SummaryItem[]): SjDiv[] {
  const set = new Set<SjDiv>()
  for (const item of items) {
    if (item.kind === 'FINANCIAL' && item.target.sjDiv !== null) set.add(item.target.sjDiv)
  }
  return [...set].sort()
}

/** changeId로 찾는 계정 값 */
export function amountsById(items: FinancialChangeItem[]): Map<number, FinancialChangeItem> {
  return new Map(items.map((item) => [item.changeId, item]))
}
