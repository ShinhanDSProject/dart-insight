import { apiGet } from './client'
import { endpoints } from './endpoints'
import type { AmountBasis, FsDiv } from './comparability'

export type CalcStatus =
  | 'OK'
  | 'PREVIOUS_ZERO'
  | 'PREVIOUS_NEGATIVE'
  | 'PREVIOUS_MISSING'
  | 'CURRENT_MISSING'
  | 'ONLY_CURRENT'
  | 'ONLY_PREVIOUS'
  | 'AMBIGUOUS_MATCH'
  | 'PERIOD_MISMATCH'

export type SjDiv = 'BS' | 'IS' | 'CIS' | 'CF' | 'SCE'

export interface StatementSummary {
  sjDiv: SjDiv
  label: string
  comparable: boolean
  amountBasis: AmountBasis | null
  note: string | null
  total: number
  changed: number
}

export interface FinancialChangeItem {
  changeId: number
  sjDiv: SjDiv
  accountName: string
  amountBasis: AmountBasis | null
  previousAmount: number | null
  currentAmount: number | null
  changeAmount: number | null
  /** 비율(0.153 = 15.3%) */
  changeRate: number | null
  direction: 'UP' | 'DOWN' | 'SAME' | null
  calcStatus: CalcStatus
  calcMessage: string | null
  currency: string | null
}

export interface FinancialChangeList {
  analysisId: number
  fsDiv: FsDiv | null
  sjDiv: SjDiv
  changedOnly: boolean
  statements: StatementSummary[]
  items: FinancialChangeItem[]
}

export function getFinancialChanges(analysisId: number, sjDiv: SjDiv, changedOnly: boolean): Promise<FinancialChangeList> {
  return apiGet(endpoints.financialChanges(analysisId), { sjDiv, changedOnly })
}

export interface ValueSource {
  rceptNo: string
  reportName: string
  fiscalYear: number
  periodEnd: string
  /** 재무제표 API의 당기 이름(예: 제 57 기 반기) */
  periodName: string | null
  sjDiv: SjDiv
  accountId: string
  dartUrl: string
}

export interface FinancialChangeDetail extends FinancialChangeItem {
  accountKey: string
  fsDiv: FsDiv
  /** 증감액 계산식(원 단위). 계산하지 않았으면 null */
  formula: string | null
  /** 증감률 계산식. 계산하지 않았으면 null */
  rateFormula: string | null
  previous: ValueSource | null
  current: ValueSource | null
}

export function getFinancialChange(analysisId: number, changeId: number): Promise<FinancialChangeDetail> {
  return apiGet(endpoints.financialChange(analysisId, changeId))
}
