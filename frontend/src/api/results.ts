import { apiGet } from './client'
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
  return apiGet(`/api/analyses/${analysisId}/financial-changes`, { sjDiv, changedOnly })
}
