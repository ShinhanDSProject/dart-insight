import type { FinancialChangeItem, SjDiv } from '@/shared/api/results'
import type { SummaryItem } from '@/shared/api/summary'
import { formatCompactAmount } from '@/shared/lib/chartScale'
import { formatRate } from './format'

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

/** 비교 막대 옆 짧은 금액(예: 153.7조 원). 없으면 '없음' */
export function compactAmount(value: number | null, currency: string | null): string {
  if (value === null) return '없음'
  return currency === null || currency === 'KRW' ? `${formatCompactAmount(value, 'KRW')} 원` : formatCompactAmount(value, currency)
}

/** 증감 방향 표시. 색만으로 구분하지 않도록 ▲▼를 함께 쓴다(UI-5). 같으면 표시 없음 */
export const DIRECTION_ARROWS: Record<'UP' | 'DOWN' | 'SAME', string | null> = { UP: '▲', DOWN: '▼', SAME: null }

/** 핵심 카드의 이전·현재 막대 한 쌍. 길이는 둘 중 큰 절댓값을 1로 본 비율(0~1), 값이 없으면 0 */
export interface AmountBars {
  previous: { label: string; ratio: number }
  current: { label: string; ratio: number }
  /** 예: '▲ +79.8%'. 증감률을 계산하지 않았으면 null */
  rate: string | null
}

export function amountBars(amount: FinancialChangeItem): AmountBars {
  const max = Math.max(Math.abs(amount.previousAmount ?? 0), Math.abs(amount.currentAmount ?? 0))
  const ratio = (value: number | null) => (value === null || max === 0 ? 0 : Math.abs(value) / max)
  const rate = formatRate(amount.changeRate)
  const arrow = amount.direction === null ? null : DIRECTION_ARROWS[amount.direction]
  return {
    previous: { label: compactAmount(amount.previousAmount, amount.currency), ratio: ratio(amount.previousAmount) },
    current: { label: compactAmount(amount.currentAmount, amount.currency), ratio: ratio(amount.currentAmount) },
    rate: rate === null ? null : arrow === null ? rate : `${arrow} ${rate}`,
  }
}
