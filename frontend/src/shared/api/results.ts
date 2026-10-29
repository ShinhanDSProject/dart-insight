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

/** 크기 맥락의 기준(#480). 매출액(손익·현금흐름 계정), 자산총계(재무상태표), 자본총계(자본변동표) */
export type ScaleBase = 'REVENUE' | 'TOTAL_ASSETS' | 'TOTAL_EQUITY'

/** 크기 비율을 계산하지 않은 사유 */
export type ScaleReason = 'CHANGE_NOT_CALCULATED' | 'BASE_NOT_FOUND' | 'BASE_MISSING' | 'BASE_NOT_POSITIVE'

/** 증감액의 크기 맥락(#480, FS-63). 증감액 ÷ 기준 계정의 현재 값 */
export interface ChangeScale {
  base: ScaleBase
  /** 기준으로 쓴 계정 이름(원문 그대로). 찾지 못하면 null */
  baseAccountName: string | null
  baseAmount: number | null
  /** 비율(0.012 = 1.2%). 계산하지 않으면 null */
  ratio: number | null
  /** ratio가 null인 사유. 계산했으면 null */
  reason: ScaleReason | null
}

/** 근거 상세의 크기 맥락: 기준 계정의 changeId, 계산식, 기준 값의 근거를 더한다 */
export interface ChangeScaleDetail extends ChangeScale {
  baseChangeId: number | null
  /** 증감액 ÷ 기준 값(기간 이름) × 100 = 퍼센트. 계산하지 않았으면 null */
  formula: string | null
  baseSource: ValueSource | null
}

/** 재무 계정 목록 순서. document 원문 순서, scale 규모 큰 순(#480) */
export type FinancialOrder = 'document' | 'scale'

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
  scale: ChangeScale
}

export interface FinancialChangeList {
  analysisId: number
  fsDiv: FsDiv | null
  sjDiv: SjDiv
  changedOnly: boolean
  sort: FinancialOrder
  statements: StatementSummary[]
  items: FinancialChangeItem[]
}

export function getFinancialChanges(
  analysisId: number,
  sjDiv: SjDiv,
  changedOnly: boolean,
  signal?: AbortSignal,
  order: FinancialOrder = 'document',
): Promise<FinancialChangeList> {
  // 기본 순서면 sort를 보내지 않는다(서버 기본값과 같음)
  const sort = order === 'document' ? undefined : order
  return apiGet(endpoints.financialChanges(analysisId), { sjDiv, changedOnly, sort }, { signal })
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
  scale: ChangeScaleDetail
}

export function getFinancialChange(analysisId: number, changeId: number, signal?: AbortSignal): Promise<FinancialChangeDetail> {
  return apiGet(endpoints.financialChange(analysisId, changeId), undefined, { signal })
}
