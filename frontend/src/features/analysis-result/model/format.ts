import type { AmountBasis } from '@/shared/api/comparability'
import type { ReportItem } from '@/shared/api/reports'

/** 금액 단위. 금액은 원 단위 정수로 오고, 단위 변환은 화면에서 한다(docs/api-spec.md). */
export type AmountUnit = 'WON' | 'THOUSAND' | 'MILLION' | 'HUNDRED_MILLION'

export const DEFAULT_UNIT: AmountUnit = 'MILLION'

export const unitOptions: { value: AmountUnit; label: string; divisor: number }[] = [
  { value: 'WON', label: '원', divisor: 1 },
  { value: 'THOUSAND', label: '천원', divisor: 1_000 },
  { value: 'MILLION', label: '백만원', divisor: 1_000_000 },
  { value: 'HUNDRED_MILLION', label: '억원', divisor: 100_000_000 },
]

export function parseUnit(value: string | null): AmountUnit {
  return unitOptions.some((o) => o.value === value) ? (value as AmountUnit) : DEFAULT_UNIT
}

const unitPrefixes: Record<AmountUnit, string> = { WON: '', THOUSAND: '천', MILLION: '백만', HUNDRED_MILLION: '억' }

/** 단위 이름. 원화가 아니면 통화 코드를 붙인다(예: 백만 USD). */
export function unitLabel(unit: AmountUnit, currency?: string | null): string {
  if (currency && currency !== 'KRW') return `${unitPrefixes[unit]} ${currency}`.trim()
  return unitOptions.find((o) => o.value === unit)?.label ?? '원'
}

const numberFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })

/** 금액을 단위로 나눠 반올림하고 천 단위로 끊는다. 없는 값은 null 그대로(0으로 보지 않음). */
function scaleAbs(value: number, unit: AmountUnit): number {
  const divisor = unitOptions.find((o) => o.value === unit)?.divisor ?? 1
  // 양수·음수를 같은 방식으로 반올림하도록 절댓값으로 계산한다
  return Math.round(Math.abs(value) / divisor)
}

export function formatAmount(value: number | null, unit: AmountUnit): string | null {
  if (value === null) return null
  const scaled = scaleAbs(value, unit)
  const sign = value < 0 && scaled !== 0 ? '−' : ''
  return `${sign}${numberFormat.format(scaled)}`
}

/** 증감액: 방향 기호와 절댓값. 예: ▲ 1,234 / ▼ 1,234 / 0. 단위보다 작은 변화는 '1 미만' */
export function formatChange(value: number | null, unit: AmountUnit): string | null {
  if (value === null) return null
  if (value === 0) return '0'
  const scaled = scaleAbs(value, unit)
  const amount = scaled === 0 ? '1 미만' : numberFormat.format(scaled)
  return value > 0 ? `▲ ${amount}` : `▼ ${amount}`
}

/** 증감률(비율): +15.3% / −4.2% / 0.0% */
export function formatRate(rate: number | null): string | null {
  if (rate === null) return null
  const percent = Math.round(Math.abs(rate) * 1000) / 10
  if (percent === 0) return '0.0%'
  return `${rate > 0 ? '+' : '−'}${percent.toFixed(1)}%`
}

/** 2026-06-30 → 2026.06.30 */
function dot(isoDate: string): string {
  return isoDate.replaceAll('-', '.')
}

/**
 * 금액의 기준일·기간. 12월 결산 보고서만 다룬다.
 * - 시점: 기말(2026.06.30)
 * - 누적: 사업연도 시작부터(2026.01.01 ~ 2026.06.30)
 * - 3개월: 기간 끝의 석 달(2026.04.01 ~ 2026.06.30)
 */
export function amountPeriodLabel(report: Pick<ReportItem, 'fiscalYear' | 'periodEnd'>, basis: AmountBasis | null): string {
  const end = dot(report.periodEnd)
  if (basis === 'POINT' || basis === null) return end
  if (basis === 'CUMULATIVE') return `${report.fiscalYear}.01.01 ~ ${end}`
  const month = Number(report.periodEnd.slice(5, 7)) - 2
  return `${report.periodEnd.slice(0, 4)}.${String(month).padStart(2, '0')}.01 ~ ${end}`
}

const shortCalcLabels: Record<string, string> = {
  PREVIOUS_ZERO: '계산 불가 · 이전 값 0',
  PREVIOUS_NEGATIVE: '계산 불가 · 이전 값 음수',
  // 이익 계정의 흑자·적자 상태(#144). 증감률 대신 상태를 보인다. 색이 아니라 글로 구분한다(UI-5)
  TURNED_PROFIT: '흑자전환',
  TURNED_LOSS: '적자전환',
  LOSS_NARROWED: '적자폭 축소',
  LOSS_WIDENED: '적자폭 확대',
  SIGN_CHANGED: '계산 불가 · 부호가 바뀜',
  PREVIOUS_MISSING: '계산 불가 · 이전 값 미기재',
  CURRENT_MISSING: '계산 불가 · 현재 값 미기재',
  ONLY_CURRENT: '계산 불가 · 이전 보고서에 없는 계정',
  ONLY_PREVIOUS: '계산 불가 · 현재 보고서에 없는 계정',
  AMBIGUOUS_MATCH: '검토 필요 · 같은 계정이 여러 개',
  PERIOD_MISMATCH: '계산 불가 · 기간 기준이 달라요',
}

const profitStates = new Set(['TURNED_PROFIT', 'TURNED_LOSS', 'LOSS_NARROWED', 'LOSS_WIDENED'])

/** 이익 계정의 흑자·적자 상태인지. 계산 불가 사유가 아니라 결과라서 흐리게 보이지 않는다 */
export function isProfitState(calcStatus: string): boolean {
  return profitStates.has(calcStatus)
}

/** 표에 넣는 짧은 계산 불가 사유나 흑자·적자 상태. 증감률을 계산했으면 null */
export function shortCalcLabel(calcStatus: string): string | null {
  return shortCalcLabels[calcStatus] ?? null
}

/** 값이 없을 때 칸에 넣는 말. 없는 값을 0으로 보이지 않게 한다. */
export function missingValueLabel(calcStatus: string, side: 'previous' | 'current'): string {
  if (calcStatus === 'PERIOD_MISMATCH') return '—'
  if (calcStatus === 'AMBIGUOUS_MATCH') return '짝 확인 필요'
  if (side === 'previous' && calcStatus === 'ONLY_CURRENT') return '없음'
  if (side === 'current' && calcStatus === 'ONLY_PREVIOUS') return '없음'
  return '미기재'
}
