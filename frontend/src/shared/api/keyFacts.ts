import { apiGet } from './client'
import { endpoints } from './endpoints'
import type { ReportType } from './reports'

/**
 * 최대주주·임원·배당 변화(docs/api-spec.md GET /api/companies/{corpCode}/key-facts, #331).
 * 값은 OpenDART 원문 표기 그대로의 문자열이다(지분율은 % 값). 원문의 '-'·빈 값은 null.
 */

export interface KeyFactReport {
  rceptNo: string
  reportName: string
  reportType: ReportType
  fiscalYear: number
  periodEnd: string
  dartUrl: string
}

/** AVAILABLE 자료 있음, NO_DATA 공시된 자료 없음(013 등), UNAVAILABLE 이번에 받지 못함 */
export type KeyFactStatus = 'AVAILABLE' | 'NO_DATA' | 'UNAVAILABLE'

export interface KeyFactSection<T> {
  rceptNo: string
  status: KeyFactStatus
  settlementDate: string | null
  rows: T[]
}

export interface MajorShareholder {
  name: string | null
  relation: string | null
  stockKind: string | null
  beginShares: string | null
  beginRatio: string | null
  endShares: string | null
  endRatio: string | null
  remark: string | null
}

export interface Executive {
  name: string | null
  position: string | null
  registeredType: string | null
  fullTime: string | null
  duty: string | null
  largestShareholderRelation: string | null
  tenure: string | null
  termEnd: string | null
}

export interface Dividend {
  category: string | null
  stockKind: string | null
  currentTerm: string | null
  priorTerm: string | null
  twoTermsAgo: string | null
}

export type KeyFactChangeType = 'ADDED' | 'REMOVED' | 'CHANGED'

export interface KeyFactChange {
  type: KeyFactChangeType
  /** 최대주주·임원은 성명, 배당은 구분 */
  name: string
  /** 임원은 null */
  stockKind: string | null
  /** 비교한 필드 이름(endRatio, endShares, position, registeredType, currentTerm) */
  field: string
  before: string | null
  after: string | null
}

export interface KeyFactGroup<T> {
  /** 보고서가 없으면 null */
  current: KeyFactSection<T> | null
  previous: KeyFactSection<T> | null
  /** 두 묶음이 모두 AVAILABLE일 때만 들어 있다 */
  changes: KeyFactChange[]
}

export interface KeyFacts {
  corpCode: string
  current: KeyFactReport | null
  previous: KeyFactReport | null
  /** previous가 null인 이유(NO_BASE_REPORT, NO_REPORTS) */
  previousReason: { code: string; message: string } | null
  majorShareholders: KeyFactGroup<MajorShareholder>
  executives: KeyFactGroup<Executive>
  dividends: KeyFactGroup<Dividend>
}

export function getKeyFacts(corpCode: string, signal?: AbortSignal): Promise<KeyFacts> {
  return apiGet(endpoints.companyKeyFacts(corpCode), undefined, { signal })
}
