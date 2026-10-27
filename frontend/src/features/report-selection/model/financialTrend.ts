import { match } from 'ts-pattern'
import type { FinancialTrend, FsDiv, KeyAccountKey, TrendPeriod } from '@/shared/api/financialTrends'
import type { ReportType } from '@/shared/api/reports'
import { barSpan, formatCompactAmount, niceScale, type Scale } from '@/shared/lib/chartScale'
import { periodRatios, RATIO_DEFINITIONS, type RatioKey, type RatioResult } from '@/shared/lib/financialRatios'

/**
 * 기업 개요의 주요 재무 흐름(FS-46). 응답 값을 고르고 늘어놓기만 하고 새 숫자를 만들지 않는다(ADR-0018).
 * 없는 값은 null 그대로 두고 0으로 그리지 않는다.
 */

/** 손익 금액 기준. 누적: 사업연도 시작부터, 3개월: 그 분기 석 달 */
export type IncomeBasis = 'CUMULATIVE' | 'QUARTER'

/** 차트 보기 · 표 보기 */
export type TrendView = 'chart' | 'table'

/** 금액(주요계정) · 비율(주요계정으로 계산, FS-54) */
export type TrendMeasure = 'amount' | 'ratio'

const REPORT_TYPE_ORDER: readonly ReportType[] = ['ANNUAL', 'HALF', 'Q1', 'Q3']

const shortTypeNames: Record<ReportType, string> = { ANNUAL: '사업', HALF: '반기', Q1: '1분기', Q3: '3분기' }

/** 차트로 먼저 보여 주는 계정(작은 차트 여러 개). 나머지는 표에서 본다 */
export const CHART_ACCOUNTS: readonly KeyAccountKey[] = [
  'REVENUE',
  'OPERATING_INCOME',
  'NET_INCOME',
  'TOTAL_ASSETS',
  'TOTAL_LIABILITIES',
  'TOTAL_EQUITY',
]

/** 응답에 있는 보고서 종류(사업 → 반기 → 1분기 → 3분기 순) */
export function availableReportTypes(periods: TrendPeriod[]): ReportType[] {
  return REPORT_TYPE_ORDER.filter((type) => periods.some((p) => p.reportType === type))
}

/**
 * 비교할 보고서 종류. 고른 종류가 응답에 있으면 그것, 아니면 가장 최근 보고서의 종류(같은 종류끼리 비교가 기본).
 * 보고서가 없으면 null.
 */
export function selectedReportType(periods: TrendPeriod[], chosen: ReportType | null): ReportType | null {
  if (chosen !== null && periods.some((p) => p.reportType === chosen)) return chosen
  return periods[0]?.reportType ?? null
}

/** 사업보고서는 4분기 3개월 값이 없어 늘 누적(1년)이다 */
export function effectiveBasis(type: ReportType, basis: IncomeBasis): IncomeBasis {
  return type === 'ANNUAL' ? 'CUMULATIVE' : basis
}

export interface SeriesPoint {
  period: TrendPeriod
  /** null이면 값 없음(0과 다름) */
  amount: number | null
  currency: string | null
}

export interface SeriesAccount {
  key: KeyAccountKey
  name: string
  sjDiv: 'BS' | 'IS'
  /** 오래된 기간부터 */
  points: SeriesPoint[]
}

export interface TrendSeries {
  /** 고른 종류의 보고서. 오래된 기간부터(왼쪽 → 오른쪽) */
  periods: TrendPeriod[]
  /** 고른 기간 중 한 번이라도 값이 있는 계정(응답 순서) */
  accounts: SeriesAccount[]
  /** 고른 기간 내내 값이 없어 뺀 계정 이름 */
  emptyAccounts: string[]
}

/** 같은 종류 보고서끼리 고른 계정별 값. 손익은 기준(누적·3개월)에 맞는 금액을 쓴다 */
export function trendSeries(trend: FinancialTrend, type: ReportType, basis: IncomeBasis): TrendSeries {
  const income = effectiveBasis(type, basis)
  const indexes = trend.periods
    .map((period, index) => ({ period, index }))
    .filter(({ period }) => period.reportType === type)
    .reverse()
  const all = trend.accounts.map((account) => ({
    key: account.key,
    name: account.name,
    sjDiv: account.sjDiv,
    points: indexes.map(({ period, index }) => {
      const value = account.values[index]
      const amount = account.sjDiv === 'IS' && income === 'QUARTER' ? value?.quarterAmount : value?.amount
      return { period, amount: amount ?? null, currency: value?.currency ?? null }
    }),
  }))
  const hasValue = (a: SeriesAccount) => a.points.some((p) => p.amount !== null)
  return {
    periods: indexes.map(({ period }) => period),
    accounts: all.filter(hasValue),
    emptyAccounts: all.filter((a) => !hasValue(a)).map((a) => a.name),
  }
}

/** 차트에 그릴 계정(정해 둔 순서) */
export function chartAccounts(series: TrendSeries): SeriesAccount[] {
  return CHART_ACCOUNTS.flatMap((key) => series.accounts.filter((a) => a.key === key))
}

/** 이번에 받지 못한 보고서 수(다시 시도하면 다시 받는다) */
export function failedCount(periods: TrendPeriod[]): number {
  return periods.filter((p) => p.dataStatus === 'FETCH_FAILED').length
}

/** 예: 2026 반기, 2025 사업 */
export function periodShortLabel(period: Pick<TrendPeriod, 'fiscalYear' | 'reportType'>): string {
  return `${period.fiscalYear} ${shortTypeNames[period.reportType]}`
}

export function fsDivLabel(fsDiv: FsDiv): string {
  return match(fsDiv)
    .with('CFS', () => '연결')
    .with('OFS', () => '별도')
    .exhaustive()
}

/** 2026-06-30 → 06.30 */
function monthDay(isoDate: string): string {
  return isoDate.slice(5).replace('-', '.')
}

/**
 * 금액 기준 안내. 재무상태표는 기말 잔액이고, 손익은 누적이나 3개월이다(도메인 가이드 4장, OpenDART 주요계정 응답으로 확인).
 * 예: "연결 기준 · 재무상태표는 기말(06.30) 잔액, 손익은 사업연도 시작부터 누적(01.01 ~ 06.30)이에요."
 */
export function basisNote(type: ReportType, basis: IncomeBasis, fsDiv: FsDiv, periodEnd: string | null): string {
  const endDay = periodEnd === null ? null : monthDay(periodEnd)
  const end = endDay === null ? '기말' : `기말(${endDay})`
  const cumulative = `손익은 사업연도 시작부터 누적(01.01 ~ ${endDay ?? '기말'})`
  const income = match(effectiveBasis(type, basis))
    .with('CUMULATIVE', () => (type === 'ANNUAL' ? '손익은 사업연도 1년(01.01 ~ 12.31)' : cumulative))
    .with('QUARTER', () => '손익은 그 분기 3개월')
    .exhaustive()
  return `${fsDivLabel(fsDiv)} 기준 · 재무상태표는 ${end} 잔액, ${income}이에요.`
}

const numberFormat = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 })
const MILLION = 1_000_000

/** 표의 금액(백만원). 없는 값은 '—'(0이 아님). 1백만원보다 작은 0 아닌 값은 '1 미만' */
export function formatTrendAmount(value: number | null): string {
  if (value === null) return '—'
  if (value === 0) return '0'
  const scaled = Math.round(Math.abs(value) / MILLION)
  const sign = value < 0 ? '−' : ''
  return scaled === 0 ? `${sign}1 미만` : `${sign}${numberFormat.format(scaled)}`
}

/** 비율 근거의 금액(표와 같은 백만원 단위). 예: 123,400백만원, 원화가 아니면 1,000 백만 USD. 없는 값은 '값 없음' */
export function formatRatioAmount(value: number | null, currency: string | null): string {
  if (value === null) return '값 없음'
  const unit = currency === null || currency === 'KRW' ? '백만원' : ` 백만 ${currency}`
  return `${formatTrendAmount(value)}${unit}`
}

/** 표의 단위. 원화가 아니면 통화 코드를 붙인다(예: 백만 USD) */
export function tableUnitLabel(series: TrendSeries): string {
  const currency = series.accounts.flatMap((a) => a.points).find((p) => p.currency !== null)?.currency ?? 'KRW'
  return currency === 'KRW' ? '백만원' : `백만 ${currency}`
}

/** 차트 값 문구(예: 305.4조원, −3,717.7억원). 없는 값은 '값 없음' */
export function formatChartAmount(value: number | null, currency: string | null): string {
  if (value === null) return '값 없음'
  const text = formatCompactAmount(value, currency)
  return currency === null || currency === 'KRW' ? `${text}원` : text
}

/** 세로 막대 하나: 축 아래에서의 위치와 높이(%). 값이 없으면 null(그리지 않음) */
export interface ColumnBar {
  bottom: number
  height: number
  negative: boolean
}

export interface Columns {
  scale: Scale
  bars: (ColumnBar | null)[]
}

/** 0을 담는 축에 0에서 값까지 세로 막대를 놓는다. 없는 값은 막대를 만들지 않는다 */
export function columnBars(amounts: (number | null)[]): Columns {
  const scale = niceScale(amounts.filter((a): a is number => a !== null), 3)
  return {
    scale,
    bars: amounts.map((amount) => {
      if (amount === null) return null
      const { left, width } = barSpan(scale, amount)
      return { bottom: left, height: width, negative: amount < 0 }
    }),
  }
}

/** 작은 차트 하나를 화면 읽기 도구에 읽어 줄 문장 */
export function accountSummary(account: SeriesAccount): string {
  const parts = account.points.map((p) => `${periodShortLabel(p.period)} ${formatChartAmount(p.amount, p.currency)}`)
  return `${account.name}: ${parts.join(', ')}`
}

export interface RatioRow {
  key: RatioKey
  name: string
  formula: string
  /** ratioTable의 periods와 같은 순서 */
  cells: RatioResult[]
}

export interface RatioTable {
  /** 고른 종류 중 값을 받은 보고서. 오래된 기간부터(금액 차트와 같은 순서) */
  periods: TrendPeriod[]
  rows: RatioRow[]
  /** 고른 종류 중 값을 받지 못했거나 값이 없어 뺀 보고서 수 */
  skipped: number
}

/**
 * 같은 종류 보고서끼리 기간별 재무 비율(FS-54). 값을 받은 기간(AVAILABLE)만 열로 두고, 손익은 금액 보기와 같은 기준(누적·3개월)을 쓴다.
 * 계산은 shared/lib/financialRatios가 하고, 여기서는 기간을 고르고 늘어놓기만 한다.
 */
export function ratioTable(trend: FinancialTrend, type: ReportType, basis: IncomeBasis): RatioTable {
  const income = effectiveBasis(type, basis)
  const ofType = trend.periods
    .map((period, index) => ({ period, index }))
    .filter(({ period }) => period.reportType === type)
  const indexes = ofType.filter(({ period }) => period.dataStatus === 'AVAILABLE').reverse()
  const columns = indexes.map(({ index }) => periodRatios(trend, index, income))
  return {
    periods: indexes.map(({ period }) => period),
    rows: RATIO_DEFINITIONS.map((def, row) => ({
      key: def.key,
      name: def.name,
      formula: def.formula,
      cells: columns.map((results) => results[row]),
    })),
    skipped: ofType.length - indexes.length,
  }
}

/** 손익 비율의 금액 기준 짧은 문구(연환산하지 않음). 예: 누적(01.01 ~ 06.30), 그 분기 3개월, 사업연도 1년 */
export function incomeBasisLabel(type: ReportType, basis: IncomeBasis, periodEnd: string): string {
  return match(effectiveBasis(type, basis))
    .with('CUMULATIVE', () => (type === 'ANNUAL' ? '사업연도 1년' : `누적(01.01 ~ ${monthDay(periodEnd)})`))
    .with('QUARTER', () => '그 분기 3개월')
    .exhaustive()
}
