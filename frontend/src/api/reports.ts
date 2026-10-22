import { apiGet } from './client'
import { endpoints } from './endpoints'

/** docs/api-spec.md 공통 값 */
export type ReportType = 'ANNUAL' | 'HALF' | 'Q1' | 'Q3'
export type Correction = 'ORIGINAL' | 'CORRECTED' | 'UNKNOWN'
export type FinancialDataStatus = 'UNKNOWN' | 'AVAILABLE' | 'NOT_AVAILABLE'

export interface ReportItem {
  rceptNo: string
  reportName: string
  reportType: ReportType
  /** OpenDART 공시상세유형(A001 사업, A002 반기, A003 분기) */
  disclosureType: string
  fiscalYear: number
  /** 대상 기간의 끝(YYYY-MM-DD) */
  periodEnd: string
  /** 제출일(YYYY-MM-DD) */
  receivedAt: string
  correction: Correction
  financialDataStatus: FinancialDataStatus
  dartUrl: string
}

export interface ReportList {
  corpCode: string
  fetchedAt: string | null
  /** OpenDART에서 다시 받지 못해 저장된 목록을 보여 줄 때 그 이유(에러 코드) */
  refreshError: string | null
  items: ReportItem[]
}

export function listReports(corpCode: string): Promise<ReportList> {
  return apiGet(endpoints.companyReports(corpCode))
}

export interface ReportDetail extends ReportItem {
  corpCode: string
  corpName: string
  /** OpenDART 비고(rm) 원문 */
  remark: string | null
  /** 제출인 */
  filerName: string | null
  /** OpenDART 최신 목록에 있는지. 정정 공시로 대체됐으면 false */
  latest: boolean
}

export function getReport(rceptNo: string): Promise<ReportDetail> {
  return apiGet(endpoints.report(rceptNo))
}

/** 비교 기준. 직접 선택(CUSTOM)은 화면에서 목록 중에 고른다. */
export type ComparisonBasis = 'YOY' | 'PREV' | 'CUSTOM'

export interface ReportPair {
  basis: ComparisonBasis
  current: ReportItem | null
  previous: ReportItem | null
  /** 고르지 못한 이유(NO_BASE_REPORT, NO_REPORTS) */
  reason: { code: string; message: string } | null
}

export function getReportPair(
  corpCode: string,
  basis: Exclude<ComparisonBasis, 'CUSTOM'>,
  currentRceptNo: string,
): Promise<ReportPair> {
  return apiGet(endpoints.reportPairs(corpCode), { basis, currentRceptNo })
}
