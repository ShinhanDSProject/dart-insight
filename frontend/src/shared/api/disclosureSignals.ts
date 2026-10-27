import { apiGet } from './client'
import { endpoints } from './endpoints'

/** docs/api-spec.md 공통 값 disclosureSignalKind(FS-55). 규칙은 backend DisclosureSignalRules가 정한다 */
export type DisclosureSignalKind =
  | 'LARGEST_SHAREHOLDER_CHANGE'
  | 'CAPITAL_INCREASE'
  | 'CONVERTIBLE_BOND'
  | 'BOND_WITH_WARRANT'
  | 'LITIGATION'
  | 'REHABILITATION_LISTING'
  | 'AUDITOR_CHANGE'
  | 'NON_CLEAN_AUDIT_OPINION'

/** CHECKED 확인함(0건이면 해당 공시 없음), UNAVAILABLE 자료를 받지 못해 확인하지 못함(없다는 뜻이 아님) */
export type DisclosureSignalStatus = 'CHECKED' | 'UNAVAILABLE'

export interface DisclosureSignalKindCount {
  kind: DisclosureSignalKind
  label: string
  status: DisclosureSignalStatus
  /** UNAVAILABLE이면 null */
  count: number | null
}

export interface DisclosureSignalItem {
  kind: DisclosureSignalKind
  rceptNo: string
  /** OpenDART 보고서명(이어진 공백은 한 칸) */
  reportName: string
  /** 접수일(YYYY-MM-DD) */
  receivedDate: string
  /** 코드가 만든 사실 문장 */
  sentence: string
  dartUrl: string
}

/** 확인해 볼 공시(docs/api-spec.md GET /api/companies/{corpCode}/disclosure-signals, #411) */
export interface DisclosureSignals {
  corpCode: string
  /** 확인한 접수일 기간(YYYY-MM-DD) */
  from: string
  to: string
  /** 모든 종류를 정해진 순서로 */
  kinds: DisclosureSignalKindCount[]
  /** 접수일이 최근인 순서 */
  items: DisclosureSignalItem[]
}

export function getDisclosureSignals(corpCode: string, signal?: AbortSignal): Promise<DisclosureSignals> {
  return apiGet(endpoints.companyDisclosureSignals(corpCode), undefined, { signal })
}
