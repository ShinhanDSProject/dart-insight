import { apiGet } from './client'
import { endpoints } from './endpoints'
import type { ReportType } from './reports'

/** docs/api-spec.md GET /api/companies/{corpCode}/financial-trends */
export type FsDiv = 'CFS' | 'OFS'

/** AVAILABLE 값 있음, NOT_AVAILABLE 없음(2015 이전·013·이 기준 없음), FETCH_FAILED 이번에 받지 못함(다음 요청에서 다시 받음) */
export type TrendDataStatus = 'AVAILABLE' | 'NOT_AVAILABLE' | 'FETCH_FAILED'

export type KeyAccountKey =
  | 'CURRENT_ASSETS'
  | 'NON_CURRENT_ASSETS'
  | 'TOTAL_ASSETS'
  | 'CURRENT_LIABILITIES'
  | 'NON_CURRENT_LIABILITIES'
  | 'TOTAL_LIABILITIES'
  | 'CAPITAL_STOCK'
  | 'RETAINED_EARNINGS'
  | 'TOTAL_EQUITY'
  | 'REVENUE'
  | 'OPERATING_INCOME'
  | 'PROFIT_BEFORE_TAX'
  | 'NET_INCOME'
  | 'COMPREHENSIVE_INCOME'

export interface TrendPeriod {
  rceptNo: string
  reportType: ReportType
  reportName: string
  fiscalYear: number
  /** 대상 기간의 끝(YYYY-MM-DD) */
  periodEnd: string
  dataStatus: TrendDataStatus
  /** 값을 받은 공시의 접수번호. 보고서와 다르면 뒤에 나온 정정 공시의 값. 값이 없으면 null */
  sourceRceptNo: string | null
  dartUrl: string
}

export interface TrendValue {
  rceptNo: string
  /** 재무상태표는 기말 잔액, 손익은 사업연도 시작부터 누적. 없으면 null(0과 다름) */
  amount: number | null
  /** 분·반기 손익의 3개월 금액. 재무상태표·사업보고서·값 없음이면 null */
  quarterAmount: number | null
  currency: string | null
}

export interface TrendAccount {
  key: KeyAccountKey
  name: string
  /** BS 재무상태표, IS 손익 */
  sjDiv: 'BS' | 'IS'
  amountBasis: 'POINT' | 'CUMULATIVE'
  /** periods와 같은 순서·같은 길이 */
  values: TrendValue[]
}

export interface FinancialTrend {
  corpCode: string
  fsDiv: FsDiv
  /** 보고서 목록을 다시 받지 못해 저장된 목록을 쓸 때 그 이유(에러 코드) */
  refreshError: string | null
  /** 대상 기간이 최근인 순서 */
  periods: TrendPeriod[]
  accounts: TrendAccount[]
}

export function getFinancialTrends(corpCode: string, fsDiv: FsDiv, signal?: AbortSignal): Promise<FinancialTrend> {
  return apiGet(endpoints.companyFinancialTrends(corpCode), { fsDiv }, { signal })
}
