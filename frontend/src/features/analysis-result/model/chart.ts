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

export interface Scale {
  min: number
  max: number
  ticks: number[]
}

/** 1·2·5 × 10^n 중 rough 이상인 가장 작은 눈금 간격 */
function niceStep(rough: number): number {
  const power = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / power
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * power
}

/**
 * 값들과 0을 함께 담는 축. 축 끝은 눈금 간격에 맞춰 넓힌다(막대는 늘 0에서 시작).
 * 값이 모두 0이면 [0, 1]로 둔다.
 */
export function niceScale(values: number[], tickCount = 4): Scale {
  const low = Math.min(0, ...values)
  const high = Math.max(0, ...values)
  if (low === high) return { min: 0, max: 1, ticks: [0, 1] }
  const step = niceStep((high - low) / tickCount)
  const min = Math.floor(low / step) * step
  const max = Math.ceil(high / step) * step
  const ticks: number[] = []
  // 소수 눈금(증감률)의 부동소수 오차를 없애려고 간격의 자릿수로 반올림한다
  const digits = Math.max(0, -Math.floor(Math.log10(step)))
  for (let i = 0; min + i * step <= max + step / 2; i++) {
    ticks.push(Number((min + i * step).toFixed(digits)))
  }
  return { min, max, ticks }
}

/** 축 위치(0~100%) */
export function position(scale: Scale, value: number): number {
  return ((value - scale.min) / (scale.max - scale.min)) * 100
}

/** 0에서 값까지 막대의 왼쪽 끝과 폭(%) */
export function barSpan(scale: Scale, value: number): { left: number; width: number } {
  const zero = position(scale, 0)
  const end = position(scale, value)
  return { left: Math.min(zero, end), width: Math.abs(end - zero) }
}

const compactFormat = new Intl.NumberFormat('ko-KR', { notation: 'compact', maximumFractionDigits: 1 })

/** 축 눈금용 짧은 금액(예: 759.5조, 3,717억). 원화가 아니면 통화 코드를 붙인다 */
export function formatCompactAmount(value: number, currency: string | null): string {
  const text = compactFormat.format(Math.abs(value))
  const sign = value < 0 ? '−' : ''
  return currency && currency !== 'KRW' ? `${sign}${text} ${currency}` : `${sign}${text}`
}

/** 축 눈금용 증감률(예: +50%, −20%, 0%) */
export function formatTickRate(rate: number): string {
  const percent = Math.round(rate * 1000) / 10
  if (percent === 0) return '0%'
  return `${percent > 0 ? '+' : '−'}${Math.abs(percent)}%`
}
