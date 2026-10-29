import { match } from 'ts-pattern'
import type { Company } from '@/shared/api/companies'
import type { FinancialTrend, FsDiv, KeyAccountKey, TrendPeriod, TrendValue } from '@/shared/api/financialTrends'
import type { ReportType } from '@/shared/api/reports'
import { formatCompactAmount } from '@/shared/lib/chartScale'
import { periodRatios, periodSourceRceptNo, RATIO_DEFINITIONS, type RatioResult } from '@/shared/lib/financialRatios'

/**
 * 여러 기업 나란히 보기(FS-56). 2~4곳의 최신 같은 종류 보고서 주요 수치를 한 표에 놓는다.
 * 열은 고른 순서 그대로이고 정렬·순위·최고·최저 강조는 하지 않는다(결정 로그 '열 정렬 허용 여부', 잠정: 정렬 없음).
 */

export const MIN_COMPANIES = 2
export const MAX_COMPANIES = 4
export const FULL_MESSAGE = `최대 ${MAX_COMPANIES}곳까지 비교할 수 있어요.`
export const PERIOD_MISMATCH_MESSAGE = '대상 기간이 달라요 · 기업마다 표시한 기간을 확인해 주세요'

const REPORT_TYPES: readonly ReportType[] = ['ANNUAL', 'HALF', 'Q1', 'Q3']
const CORP_CODE = /^\d{8}$/

/** 주소의 corps(쉼표로 이은 고유번호 8자리). 잘못된 값·겹치는 값은 빼고 앞에서부터 4곳까지 */
export function parseCorps(value: string | null): string[] {
  if (value === null) return []
  const codes = value
    .split(',')
    .map((code) => code.trim())
    .filter((code) => CORP_CODE.test(code))
  return [...new Set(codes)].slice(0, MAX_COMPANIES)
}

/** 주소에 쓰는 corps 값. 비었으면 null(쿼리에서 지움) */
export function serializeCorps(corps: readonly string[]): string | null {
  return corps.length === 0 ? null : corps.join(',')
}

/** 주소의 type. 모르는 값이면 사업보고서 */
export function parseReportType(value: string | null): ReportType {
  return REPORT_TYPES.find((type) => type === value) ?? 'ANNUAL'
}

/** 주소의 fs. 모르는 값이면 연결 */
export function parseFsDiv(value: string | null): FsDiv {
  return value === 'OFS' ? 'OFS' : 'CFS'
}

export type AddResult = { status: 'added'; corps: string[] } | { status: 'duplicate' } | { status: 'full' }

/** 뒤에 더한다. 이미 있으면 그대로, 4곳이 차 있으면 더하지 않는다 */
export function addCompany(corps: readonly string[], corpCode: string): AddResult {
  if (corps.includes(corpCode)) return { status: 'duplicate' }
  if (corps.length >= MAX_COMPANIES) return { status: 'full' }
  return { status: 'added', corps: [...corps, corpCode] }
}

export function removeCompany(corps: readonly string[], corpCode: string): string[] {
  return corps.filter((code) => code !== corpCode)
}

// --- 기업마다 불러온 결과 ---

/** 한 기업의 기업 정보·주요 재무 흐름. 이름은 기업 정보를 받지 못해도 비워 두고 표는 그대로 그린다 */
export type CompanyLoad =
  | { status: 'loading' }
  | { status: 'success'; company: Company | null; trend: FinancialTrend }
  | { status: 'error'; company: Company | null; error: unknown }

export type SettledLoad = Exclude<CompanyLoad, { status: 'loading' }>

/** 불러온 결과는 기업·재무제표 기준마다 따로 둔다(기준을 바꿔도 이미 받은 것은 다시 부르지 않음) */
export function loadKey(corpCode: string, fsDiv: FsDiv): string {
  return `${fsDiv}:${corpCode}`
}

export type LoadsState = Readonly<Record<string, CompanyLoad>>

export type LoadsAction =
  | { type: 'start'; key: string }
  | { type: 'settle'; key: string; load: SettledLoad }
  | { type: 'drop'; keys: string[] }

/** 응답은 불러오는 중일 때만 받는다. drop은 취소한(불러오는 중인) 것만 지운다 */
export function loadsReducer(state: LoadsState, action: LoadsAction): LoadsState {
  return match<LoadsAction, LoadsState>(action)
    .with({ type: 'start' }, ({ key }) => (state[key]?.status === 'loading' ? state : { ...state, [key]: { status: 'loading' } }))
    .with({ type: 'settle' }, ({ key, load }) => (state[key]?.status === 'loading' ? { ...state, [key]: load } : state))
    .with({ type: 'drop' }, ({ keys }) => {
      const removable = keys.filter((key) => state[key]?.status === 'loading')
      if (removable.length === 0) return state
      const next = { ...state }
      removable.forEach((key) => delete next[key])
      return next
    })
    .exhaustive()
}

// --- 비교할 기간 고르기 ---

export type PeriodPick =
  | {
      status: 'picked'
      /** trend.periods 안의 위치 */
      index: number
      period: TrendPeriod
      /** 더 최근 보고서가 있지만 값을 받지 못해 이전 보고서를 골랐는지 */
      newerFailed: boolean
    }
  /** 고른 종류의 보고서가 없음 */
  | { status: 'no-report' }
  /** 보고서는 있지만 모두 주요계정 값이 없음(013 등) */
  | { status: 'no-data' }
  /** 보고서는 있지만 이번에 값을 받지 못함(다시 시도하면 다시 받음) */
  | { status: 'fetch-failed' }

/** 고른 종류 보고서 중 대상 기간이 가장 최근이고 값(AVAILABLE)이 있는 기간 */
export function pickLatestPeriod(periods: readonly TrendPeriod[], type: ReportType): PeriodPick {
  const candidates = periods
    .map((period, index) => ({ period, index }))
    .filter(({ period }) => period.reportType === type)
    .sort((a, b) => b.period.periodEnd.localeCompare(a.period.periodEnd))
  if (candidates.length === 0) return { status: 'no-report' }
  const position = candidates.findIndex(({ period }) => period.dataStatus === 'AVAILABLE')
  if (position === -1) {
    return candidates.some(({ period }) => period.dataStatus === 'FETCH_FAILED')
      ? { status: 'fetch-failed' }
      : { status: 'no-data' }
  }
  const { period, index } = candidates[position]
  const newerFailed = candidates.slice(0, position).some(({ period: p }) => p.dataStatus === 'FETCH_FAILED')
  return { status: 'picked', index, period, newerFailed }
}

/** 고른 보고서와 같은 종류이면서 직전 회계연도(fiscalYear - 1)이고 값(AVAILABLE)이 있는 보고서 */
export function findPreviousPeriod(
  periods: readonly TrendPeriod[],
  type: ReportType,
  currentFiscalYear: number,
): { period: TrendPeriod; index: number } | null {
  const candidates = periods
    .map((period, index) => ({ period, index }))
    .filter(
      ({ period }) =>
        period.reportType === type && period.fiscalYear === currentFiscalYear - 1 && period.dataStatus === 'AVAILABLE',
    )
    .sort((a, b) => b.period.periodEnd.localeCompare(a.period.periodEnd))
  return candidates[0] ?? null
}

// --- 열(기업 하나) ---

export const ACCOUNT_ROWS: readonly { key: KeyAccountKey; name: string }[] = [
  { key: 'REVENUE', name: '매출액' },
  { key: 'OPERATING_INCOME', name: '영업이익' },
  { key: 'NET_INCOME', name: '당기순이익' },
  { key: 'TOTAL_ASSETS', name: '자산총계' },
  { key: 'TOTAL_LIABILITIES', name: '부채총계' },
  { key: 'TOTAL_EQUITY', name: '자본총계' },
]

interface ColumnBase {
  corpCode: string
  /** 기업 이름. 모르면 고유번호 */
  name: string
}

export type ComparisonColumn =
  | (ColumnBase & { status: 'loading' })
  | (ColumnBase & { status: 'failed'; error: unknown })
  | (ColumnBase & { status: 'no-report' })
  | (ColumnBase & { status: 'no-data' })
  | (ColumnBase & {
      status: 'ready'
      period: TrendPeriod
      /** 직전 연도 동종 보고서. 없으면 null */
      previousPeriod: TrendPeriod | null
      /** 값의 근거 공시 접수번호(정정 공시 값이면 그 접수번호) */
      sourceRceptNo: string
      newerFailed: boolean
      /** ACCOUNT_ROWS 순서. 응답에 계정이 없으면 null */
      amounts: (TrendValue | null)[]
      previousAmounts: (TrendValue | null)[] | null
      /** RATIO_DEFINITIONS 순서 */
      ratios: RatioResult[]
      previousRatios: RatioResult[] | null
    })

/**
 * 고른 순서대로 열을 만든다. names는 화면에서 고르며 알게 된 이름(주소로 바로 열면 비어 있음)이다.
 * 손익은 누적 금액(사업연도 시작부터)을 쓴다. 사업보고서는 곧 1년 값이다.
 */
export function buildColumns(
  corps: readonly string[],
  loads: LoadsState,
  fsDiv: FsDiv,
  type: ReportType,
  names: Readonly<Record<string, string>>,
): ComparisonColumn[] {
  return corps.map((corpCode) => {
    const load: CompanyLoad = loads[loadKey(corpCode, fsDiv)] ?? { status: 'loading' }
    const company = load.status === 'loading' ? null : load.company
    const base: ColumnBase = { corpCode, name: company?.corpName ?? names[corpCode] ?? corpCode }
    return match<CompanyLoad, ComparisonColumn>(load)
      .with({ status: 'loading' }, () => ({ ...base, status: 'loading' }))
      .with({ status: 'error' }, ({ error }) => ({ ...base, status: 'failed', error }))
      .with({ status: 'success' }, ({ trend }) => readyColumn(base, trend, type))
      .exhaustive()
  })
}

function readyColumn(base: ColumnBase, trend: FinancialTrend, type: ReportType): ComparisonColumn {
  const pick = pickLatestPeriod(trend.periods, type)
  return match<PeriodPick, ComparisonColumn>(pick)
    .with({ status: 'no-report' }, () => ({ ...base, status: 'no-report' }))
    .with({ status: 'no-data' }, () => ({ ...base, status: 'no-data' }))
    .with({ status: 'fetch-failed' }, () => ({ ...base, status: 'failed', error: null }))
    .with({ status: 'picked' }, ({ index, period, newerFailed }) => {
      const prev = findPreviousPeriod(trend.periods, type, period.fiscalYear)
      return {
        ...base,
        status: 'ready',
        period,
        previousPeriod: prev?.period ?? null,
        sourceRceptNo: periodSourceRceptNo(period),
        newerFailed,
        amounts: ACCOUNT_ROWS.map(({ key }) => trend.accounts.find((a) => a.key === key)?.values[index] ?? null),
        previousAmounts: prev
          ? ACCOUNT_ROWS.map(({ key }) => trend.accounts.find((a) => a.key === key)?.values[prev.index] ?? null)
          : null,
        ratios: periodRatios(trend, index, 'CUMULATIVE'),
        previousRatios: prev ? periodRatios(trend, prev.index, 'CUMULATIVE') : null,
      }
    })
    .exhaustive()
}

export type ReadyColumn = Extract<ComparisonColumn, { status: 'ready' }>

export function isReady(column: ComparisonColumn): column is ReadyColumn {
  return column.status === 'ready'
}

// --- 행 ---

/**
 * 주요계정 전년 동기 대비 증감률 보조 문구 계산.
 * - 전년 보고서가 없으면 null (보조 줄 미표시)
 * - 전년 값이 없으면 '전년 자료 없음'
 * - 정상 증감: '전년 대비 ▲ +12.3%', '전년 대비 ▼ −8.5%', '전년과 같음 (0.0%)'
 * - 전년 0: '전년 대비 (전년 0)'
 * - 전년 음수/부호 전환: 손익계정(영업이익, 순이익)은 '전년 대비 흑자 전환' / '전년 대비 적자 전환', 비손익이나 음수 유지는 '전년 대비 (전년 음수)'
 */
export function calculateAmountYoy(
  key: KeyAccountKey,
  currentVal: TrendValue | null,
  previousVal: TrendValue | null,
  hasPreviousPeriod: boolean,
): string | null {
  if (!hasPreviousPeriod) return null
  if (currentVal === null || currentVal.amount === null) return null
  if (previousVal === null || previousVal.amount === null) return '전년 자료 없음'

  const cur = currentVal.amount
  const prev = previousVal.amount

  const isProfit = key === 'OPERATING_INCOME' || key === 'NET_INCOME'

  if (prev === 0) return '전년 대비 (전년 0)'
  if (prev < 0) {
    if (isProfit && cur > 0) return '전년 대비 흑자 전환'
    return '전년 대비 (전년 음수)'
  }
  if (cur < 0) {
    if (isProfit) return '전년 대비 적자 전환'
    return '전년 대비 (음수 전환)'
  }
  if (cur === prev) return '전년과 같음 (0.0%)'

  const rate = ((cur - prev) / prev) * 100
  const rounded = Math.round(Math.abs(rate) * 10) / 10
  if (rounded === 0) return '전년과 같음 (0.0%)'
  const formatted = rounded.toFixed(1)
  return rate > 0 ? `전년 대비 ▲ +${formatted}%` : `전년 대비 ▼ −${formatted}%`
}

/**
 * 재무 비율 전년 동기 대비 변동폭(%p) 보조 문구 계산.
 * - 전년 보고서가 없거나, 이전 비율/현재 비율 중 하나라도 계산 불가(null)이면 null (생략)
 * - '전년 대비 ▲ +3.4%p', '전년 대비 ▼ −1.2%p', '전년 대비 0.0%p'
 */
export function calculateRatioYoy(
  currentResult: Pick<RatioResult, 'value'>,
  previousResult: Pick<RatioResult, 'value'> | null,
  hasPreviousPeriod: boolean,
): string | null {
  if (!hasPreviousPeriod || previousResult === null) return null
  if (currentResult.value === null || previousResult.value === null) return null

  const diff = currentResult.value - previousResult.value
  const rounded = Math.round(Math.abs(diff) * 10) / 10
  if (rounded === 0) return '전년 대비 0.0%p'
  const formatted = rounded.toFixed(1)
  return diff > 0 ? `전년 대비 ▲ +${formatted}%p` : `전년 대비 ▼ −${formatted}%p`
}

/** 칸 하나. none은 그 열이 준비되지 않아 칸 대신 열 전체에 상태를 보여 준다 */
export type AmountCell =
  | { status: 'value'; amount: number; currency: string | null; yoy: string | null }
  | { status: 'missing' }
  | { status: 'none' }
export type RatioCell =
  | { status: 'value'; result: RatioResult; yoy: string | null }
  | { status: 'none' }

export type ComparisonRow =
  | { kind: 'amount'; key: KeyAccountKey; name: string; cells: AmountCell[] }
  | { kind: 'ratio'; key: RatioResult['key']; name: string; formula: string; cells: RatioCell[] }

/** 주요계정 6행 → 비율 4행. 칸은 열과 같은 순서 */
export function comparisonRows(columns: readonly ComparisonColumn[]): ComparisonRow[] {
  const amountRows: ComparisonRow[] = ACCOUNT_ROWS.map(({ key, name }, row) => ({
    kind: 'amount',
    key,
    name,
    cells: columns.map((column): AmountCell => {
      if (!isReady(column)) return { status: 'none' }
      const value = column.amounts[row]
      if (value === null || value.amount === null) return { status: 'missing' }
      const prevValue = column.previousAmounts ? column.previousAmounts[row] : null
      const yoy = calculateAmountYoy(key, value, prevValue, column.previousPeriod !== null)
      return { status: 'value', amount: value.amount, currency: value.currency, yoy }
    }),
  }))
  const ratioRows: ComparisonRow[] = RATIO_DEFINITIONS.map((def, row) => ({
    kind: 'ratio',
    key: def.key,
    name: def.name,
    formula: def.formula,
    cells: columns.map((column): RatioCell => {
      if (!isReady(column)) return { status: 'none' }
      const currentResult = column.ratios[row]
      const prevResult = column.previousRatios ? column.previousRatios[row] : null
      const yoy = calculateRatioYoy(currentResult, prevResult, column.previousPeriod !== null)
      return { status: 'value', result: currentResult, yoy }
    }),
  }))
  return [...amountRows, ...ratioRows]
}

/** 표에 놓인 기업들의 대상 기간(끝 날짜)이 서로 다른지 */
export function periodsDiffer(columns: readonly ComparisonColumn[]): boolean {
  return new Set(columns.filter(isReady).map((column) => column.period.periodEnd)).size > 1
}

/** 금액(예: 305.4조원, −3,717.7억원). 원화가 아니면 통화 코드를 붙인다 */
export function formatAmount(amount: number, currency: string | null): string {
  const text = formatCompactAmount(amount, currency)
  return currency === null || currency === 'KRW' ? `${text}원` : text
}
