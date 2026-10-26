import type { FinancialChangeItem } from '@/shared/api/results'

/** 차트에 그리는 계정 수(FS-3 R1) */
export const CHART_LIMIT = 10

/** 차트 보기: 증감률(0 기준 가로 막대) · 금액(이전 → 현재 덤벨) */
export type ChartView = 'rate' | 'amount'

/** 차트에 그릴 수 있는 계정: 이전·현재 값과 증감액이 모두 있음 */
export type ChartItem = FinancialChangeItem & { previousAmount: number; currentAmount: number; changeAmount: number }

export interface ChartData {
  /** 증감액 절댓값이 큰 순. 같으면 원문(표) 순서 */
  items: ChartItem[]
  /** 값이 없거나 계산하지 못해 뺀 계정 수(0으로 그리지 않음) */
  excluded: number
  /** 그릴 수 있지만 상위 개수에 들지 못한 계정 수 */
  rest: number
}

function isChartItem(item: FinancialChangeItem): item is ChartItem {
  return item.previousAmount !== null && item.currentAmount !== null && item.changeAmount !== null
}

/**
 * 차트에 그릴 계정을 고른다. 응답 값을 정렬·고르기만 하고 새 숫자를 만들지 않는다(ADR-0018).
 * 값이 없는 계정은 0으로 그리지 않고 excluded로 센다.
 */
export function chartData(items: FinancialChangeItem[], limit = CHART_LIMIT): ChartData {
  const drawable = items.filter(isChartItem)
  const ranked = drawable
    .map((item, index) => ({ item, index }))
    .sort((a, b) => Math.abs(b.item.changeAmount) - Math.abs(a.item.changeAmount) || a.index - b.index)
    .map(({ item }) => item)
  return {
    items: ranked.slice(0, limit),
    excluded: items.length - drawable.length,
    rest: Math.max(0, drawable.length - limit),
  }
}

/** 축 눈금용 증감률(예: +50%, −20%, 0%) */
export function formatTickRate(rate: number): string {
  const percent = Math.round(rate * 1000) / 10
  if (percent === 0) return '0%'
  return `${percent > 0 ? '+' : '−'}${Math.abs(percent)}%`
}
