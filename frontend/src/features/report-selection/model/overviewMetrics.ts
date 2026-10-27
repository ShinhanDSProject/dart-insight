import type { FinancialTrend, FsDiv, KeyAccountKey, TrendPeriod } from '@/shared/api/financialTrends'
import { formatCompactAmount } from '@/shared/lib/chartScale'
import type { StatChange } from '@/shared/ui'

/**
 * 기업 개요 상단 지표 줄(FS-58). 주요 재무 흐름 응답(FS-46)에서 가장 최근 사업보고서의 매출액·영업이익·당기순이익과
 * 한 해 전 사업보고서 값을 고르고, 증감액·증감률을 코드가 계산한다. 없는 값은 null 그대로 둔다(0과 다름).
 */

export const METRIC_ACCOUNTS: readonly KeyAccountKey[] = ['REVENUE', 'OPERATING_INCOME', 'NET_INCOME']

const fallbackNames: Record<string, string> = {
  REVENUE: '매출액',
  OPERATING_INCOME: '영업이익',
  NET_INCOME: '당기순이익',
}

/** 흑자·적자 표현을 쓰는 이익 계정(docs/api-spec.md 재무 변화의 이익 계정과 같은 기준) */
const PROFIT_ACCOUNTS: ReadonlySet<KeyAccountKey> = new Set(['OPERATING_INCOME', 'NET_INCOME'])

export interface MetricItem {
  key: KeyAccountKey
  name: string
  /** 최근 사업보고서 값. 없으면 null */
  amount: number | null
  /** 한 해 전 사업보고서 값. 없으면 null */
  previousAmount: number | null
  currency: string | null
  /** 증감액(현재 − 전기). 두 값 중 하나라도 없으면 null */
  change: number | null
  /** 증감률(비율, 0.048 = 4.8%). 계산하지 않았으면 null이고 reason에 사유 */
  rate: number | null
  /** 증감률을 계산하지 않은 사유나 비교할 값이 없을 때의 문구 */
  reason: string | null
}

export interface OverviewMetrics {
  fsDiv: FsDiv
  /** 값의 근거 사업보고서 */
  latest: TrendPeriod
  /** 한 해 전 사업보고서. 응답에 없으면 null */
  previous: TrendPeriod | null
  items: MetricItem[]
}

/** 가장 최근 사업보고서: 값을 받은 것 중 가장 최근, 없으면 가장 최근 사업보고서. 사업보고서가 없으면 null */
function latestAnnual(periods: TrendPeriod[]): TrendPeriod | null {
  const annual = periods.filter((p) => p.reportType === 'ANNUAL')
  return annual.find((p) => p.dataStatus === 'AVAILABLE') ?? annual[0] ?? null
}

/** 증감률을 계산하지 않는 사유. 계산할 수 있으면 null(이전 값 0·음수·부호 바뀜이면 계산하지 않는다, AGENTS.md·#144) */
function rateReason(key: KeyAccountKey, previous: number, current: number): string | null {
  if (previous === 0) return '전기 값이 0이라 증감률을 계산하지 않아요.'
  if (previous > 0 && current >= 0) return null
  if (PROFIT_ACCOUNTS.has(key)) {
    if (previous > 0) return '적자전환'
    if (current > 0) return '흑자전환'
    if (current === 0) return '전기 값이 음수라 증감률을 계산하지 않아요.'
    if (current > previous) return '적자폭 축소'
    if (current < previous) return '적자폭 확대'
    return '적자 지속'
  }
  return previous > 0 ? '부호가 바뀌어 증감률을 계산하지 않아요.' : '전기 값이 음수라 증감률을 계산하지 않아요.'
}

export function metricItem(key: KeyAccountKey, name: string, amount: number | null, previousAmount: number | null, currency: string | null): MetricItem {
  const base = { key, name, amount, previousAmount, currency }
  if (amount === null) return { ...base, change: null, rate: null, reason: null }
  if (previousAmount === null) return { ...base, change: null, rate: null, reason: '전기 값이 없어요.' }
  const change = amount - previousAmount
  const reason = rateReason(key, previousAmount, amount)
  return { ...base, change, rate: reason === null ? change / previousAmount : null, reason }
}

/** 응답에서 지표 줄을 만든다. 사업보고서가 없으면 null */
export function overviewMetrics(trend: FinancialTrend): OverviewMetrics | null {
  const latest = latestAnnual(trend.periods)
  if (latest === null) return null
  const latestIndex = trend.periods.indexOf(latest)
  const previousIndex = trend.periods.findIndex((p) => p.reportType === 'ANNUAL' && p.fiscalYear === latest.fiscalYear - 1)
  const previous = previousIndex < 0 ? null : trend.periods[previousIndex]
  const items = METRIC_ACCOUNTS.map((key) => {
    const account = trend.accounts.find((a) => a.key === key)
    const current = account?.values[latestIndex]
    const prior = previousIndex < 0 ? undefined : account?.values[previousIndex]
    return metricItem(
      key,
      account?.name ?? fallbackNames[key],
      current?.amount ?? null,
      prior?.amount ?? null,
      current?.currency ?? prior?.currency ?? null,
    )
  })
  return { fsDiv: trend.fsDiv, latest, previous, items }
}

/** 지표 값이 하나라도 있는가(없으면 다른 재무제표 기준을 본다) */
export function hasMetricValues(metrics: OverviewMetrics | null): boolean {
  return metrics?.items.some((item) => item.amount !== null) ?? false
}

/** 큰 숫자 문구(예: 305.4조, −3,717.7억). 단위 '원'은 따로 붙인다. 원화가 아니면 통화 코드가 붙는다 */
export function formatMetricAmount(value: number, currency: string | null): string {
  return formatCompactAmount(value, currency)
}

/** 큰 숫자 뒤 단위. 원화면 '원', 아니면 숫자에 통화 코드가 붙어 비운다 */
export function metricUnit(currency: string | null): string {
  return currency === null || currency === 'KRW' ? '원' : ''
}

/** 증감률(비율): +15.3% / −4.2% / 0.0% */
export function formatMetricRate(rate: number): string {
  const percent = Math.round(Math.abs(rate) * 1000) / 10
  if (percent === 0) return '0.0%'
  return `${rate > 0 ? '+' : '−'}${percent.toFixed(1)}%`
}

/** StatNumber 보조 줄. 증감액이 없으면 null */
export function metricChange(item: MetricItem): StatChange | null {
  if (item.change === null) return null
  let direction: StatChange['direction'] = 'same'
  if (item.change > 0) direction = 'up'
  if (item.change < 0) direction = 'down'
  return {
    direction,
    amount: `${formatCompactAmount(Math.abs(item.change), item.currency)}${metricUnit(item.currency)}`,
    rate: item.rate === null ? null : formatMetricRate(item.rate),
  }
}

/** 사업보고서 손익의 기간(사업연도 1년). 예: 2025 사업연도(~ 2025.12.31) */
export function annualPeriodLabel(period: Pick<TrendPeriod, 'fiscalYear' | 'periodEnd'>): string {
  return `${period.fiscalYear} 사업연도(~ ${period.periodEnd.replaceAll('-', '.')})`
}
