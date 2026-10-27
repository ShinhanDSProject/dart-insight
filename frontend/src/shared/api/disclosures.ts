import { apiGet } from './client'
import { endpoints } from './endpoints'

/** docs/api-spec.md 공통 값 disclosureGroup. 공시 제목 낱말 규칙으로 backend가 정한다 */
export type DisclosureGroup = 'PERIODIC' | 'OWNERSHIP' | 'FUNDING' | 'GOVERNANCE' | 'BUSINESS' | 'OTHER'

export interface DisclosureItem {
  rceptNo: string
  /** OpenDART 보고서명(이어진 공백은 한 칸) */
  reportName: string
  /** 제출인. 지분 공시는 회사가 아닌 사람·법인일 수 있다 */
  filerName: string | null
  /** 접수일(YYYY-MM-DD) */
  receivedDate: string
  group: DisclosureGroup
  groupLabel: string
  /** 이 서비스의 정기보고서 목록에 들어가는 보고서인지('이 보고서로 비교하기') */
  periodic: boolean
  dartUrl: string
  /** 비고(rm) 원문 */
  remarks: string | null
  /** 핵심 수치를 받을 수 있는 주요사항보고서면 그 종류(FS-51). null이면 '핵심 수치'를 두지 않는다 */
  keyItemsKind: KeyItemsKind | null
}

/** docs/api-spec.md 공통 값 keyItemsKind. 공시 제목 규칙으로 backend가 정한다 */
export type KeyItemsKind =
  | 'CAPITAL_INCREASE'
  | 'CONVERTIBLE_BOND'
  | 'BOND_WITH_WARRANT'
  | 'EXCHANGEABLE_BOND'
  | 'TREASURY_STOCK_ACQUISITION'
  | 'TREASURY_STOCK_DISPOSAL'
  | 'LITIGATION'
  | 'STOCK_ACQUISITION'

export interface DisclosureKeyItem {
  /** OpenDART 응답 필드 이름(근거 위치) */
  field: string
  /** OpenDART 개발가이드의 항목 이름 */
  label: string
  /** 원문 표기 그대로(쉼표·날짜 표기 포함) */
  value: string
  /** 개발가이드의 단위(원, 주, %, 원/주) */
  unit: string | null
}

/**
 * 주요사항보고서 한 건의 핵심 수치(docs/api-spec.md GET .../disclosures/{rceptNo}/key-items, FS-51).
 * NO_DATA면 items는 빈 배열이다.
 */
export interface DisclosureKeyItems {
  rceptNo: string
  kind: KeyItemsKind
  kindLabel: string
  status: 'AVAILABLE' | 'NO_DATA'
  items: DisclosureKeyItem[]
  sourceUrl: string
  fetchedAt: string
}

export function getDisclosureKeyItems(
  corpCode: string,
  rceptNo: string,
  signal?: AbortSignal,
): Promise<DisclosureKeyItems> {
  return apiGet(endpoints.disclosureKeyItems(corpCode, rceptNo), undefined, { signal })
}

export interface DisclosureGroupCount {
  group: DisclosureGroup
  label: string
  count: number
}

export interface DisclosureList {
  corpCode: string
  days: number
  /** 이번 응답이 다룬 접수일 기간(YYYY-MM-DD) */
  from: string
  to: string
  fetchedAt: string | null
  /** OpenDART에서 다시 받지 못해 저장된 목록을 보여 줄 때 그 이유(에러 코드) */
  refreshError: string | null
  /** 묶음별 건수(거르기와 관계없이 기간 전체, 모든 묶음) */
  groups: DisclosureGroupCount[]
  items: DisclosureItem[]
}

export function listDisclosures(corpCode: string, signal?: AbortSignal, days?: number): Promise<DisclosureList> {
  return apiGet(endpoints.companyDisclosures(corpCode), days === undefined ? undefined : { days }, { signal })
}
