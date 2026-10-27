import { apiGet } from './client'
import { endpoints } from './endpoints'
import type { AmountBasis, FsDiv } from './comparability'

export type CalcStatus =
  | 'OK'
  | 'PREVIOUS_ZERO'
  | 'PREVIOUS_NEGATIVE'
  /** 이익 계정의 흑자전환·적자전환·적자폭 축소·확대(#144). 증감액만 있고 증감률은 null */
  | 'TURNED_PROFIT'
  | 'TURNED_LOSS'
  | 'LOSS_NARROWED'
  | 'LOSS_WIDENED'
  /** 이익 계정이 아닌 계정의 부호가 바뀜. 증감률은 null */
  | 'SIGN_CHANGED'
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
  /** 자본변동표의 계정 상세(OpenDART account_detail, 자본 구성요소). 다른 재무제표는 null(#401) */
  accountDetail: string | null
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

export function getFinancialChanges(
  analysisId: number,
  sjDiv: SjDiv,
  changedOnly: boolean,
  signal?: AbortSignal,
): Promise<FinancialChangeList> {
  return apiGet(endpoints.financialChanges(analysisId), { sjDiv, changedOnly }, { signal })
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

export function getFinancialChange(analysisId: number, changeId: number, signal?: AbortSignal): Promise<FinancialChangeDetail> {
  return apiGet(endpoints.financialChange(analysisId, changeId), undefined, { signal })
}
