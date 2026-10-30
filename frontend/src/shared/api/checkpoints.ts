import { apiGet } from './client'
import { endpoints } from './endpoints'

/** docs/api-spec.md GET /api/companies/{corpCode}/checkpoints의 항목 키(FS-62). 순서는 backend CheckpointKey */
export type CheckpointKey =
  | 'EARNINGS_QUALITY'
  | 'RECEIVABLES'
  | 'INVENTORIES'
  | 'DEBT_RATIO'
  | 'SHORT_TERM_BORROWINGS'
  | 'FUNDING_DISCLOSURES'
  | 'AUDIT_OPINION'

/** CHECK 확인해 볼 점, OK 특이사항 없음, NO_DATA 자료 없음(0과 구분). 좋고 나쁨이 아니다 */
export type CheckpointStatus = 'CHECK' | 'OK' | 'NO_DATA'

/** PRESENCE는 있음 1·없음 0(#546) */
export type CheckpointFactUnit = 'AMOUNT' | 'PERCENT' | 'PERCENT_POINT' | 'COUNT' | 'PRESENCE'

/** 값이 null인 이유 */
export type CheckpointFactReason = 'MISSING' | 'PREVIOUS_ZERO' | 'PREVIOUS_NEGATIVE' | 'EQUITY_NOT_POSITIVE' | 'NOT_CHECKED'

export interface CheckpointEvidence {
  /** OpenDART 응답의 접수번호 */
  rceptNo: string
  fsDiv: 'CFS' | 'OFS'
  sjDiv: string
  statementName: string
  accountId: string
  accountName: string
  dartUrl: string
}

/** 공시 문구가 근거인 값의 원문 일부(#546). text는 원문 그대로 */
export interface CheckpointQuote {
  text: string
  rceptNo: string
  dartUrl: string
}

export interface CheckpointFact {
  label: string
  /** 없으면 null(0과 구분). 그때 reason이 이유 */
  value: number | null
  unit: CheckpointFactUnit
  /** AMOUNT일 때 통화 */
  currency: string | null
  reason: CheckpointFactReason | null
  /** 재무제표 계정 값이면 근거, 계산한 값·건수면 null */
  evidence: CheckpointEvidence | null
  /** 공시 문구가 근거인 값(계속기업 관련 강조사항이 있음)이면 원문 일부, 아니면 null */
  quote?: CheckpointQuote | null
}

export interface CheckpointDisclosure {
  rceptNo: string
  reportName: string
  /** YYYY-MM-DD */
  receivedDate: string
  dartUrl: string
}

export interface CheckpointItem {
  key: CheckpointKey
  title: string
  status: CheckpointStatus
  statusLabel: string
  /** 투자자가 이 항목을 왜 보는지(일반 설명, 이 회사 평가가 아님) */
  why: string
  formula: string
  threshold: string
  note: string | null
  facts: CheckpointFact[]
  disclosures: CheckpointDisclosure[]
}

export interface CheckpointReport {
  rceptNo: string
  reportName: string
  fiscalYear: number
  periodEnd: string
  dartUrl: string
}

/** 재무 체크 포인트(docs/api-spec.md GET /api/companies/{corpCode}/checkpoints, #479) */
export interface CompanyCheckpoints {
  corpCode: string
  status: 'AVAILABLE' | 'NOT_AVAILABLE'
  reason: 'NO_REPORT' | 'NO_PREVIOUS_REPORT' | null
  message: string | null
  currentReport: CheckpointReport | null
  previousReport: CheckpointReport | null
  fsDiv: 'CFS' | 'OFS' | null
  statementStatus: 'AVAILABLE' | 'NOT_AVAILABLE' | 'FETCH_FAILED' | null
  disclosureFrom: string | null
  disclosureTo: string | null
  /** AVAILABLE이면 일곱 항목, NOT_AVAILABLE이면 빈 배열 */
  items: CheckpointItem[]
}

export function getCompanyCheckpoints(corpCode: string, signal?: AbortSignal): Promise<CompanyCheckpoints> {
  return apiGet(endpoints.companyCheckpoints(corpCode), undefined, { signal })
}
