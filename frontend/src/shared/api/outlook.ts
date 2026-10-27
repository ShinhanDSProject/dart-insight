import type { BriefingAi, BriefingReport } from './briefing'
import { apiGet } from './client'
import { endpoints } from './endpoints'

/** docs/api-spec.md GET /api/companies/{corpCode}/outlook (1.9, FS-59, ADR-0039) */
export type OutlookStatus = 'GENERATED' | 'EMPTY' | 'REVIEW_NEEDED' | 'NOT_AVAILABLE'

/** NOT_AVAILABLE의 사유 */
export type OutlookUnavailableReason = 'NO_REPORT' | 'NO_DOCUMENT' | 'NO_SOURCE'

/** 항목 종류. 응답은 이 순서로 온다 */
export type OutlookCategory = 'INVESTMENT' | 'NEW_BUSINESS' | 'MARKET' | 'FINANCIAL' | 'OTHER'

/** 인용(quote)이 든 원문 위치 */
export interface OutlookEvidence {
  evidenceId: string
  rceptNo: string
  sectionNo: number
  blockNo: number
  /** 상위 목차부터 이은 제목(' > '로 이음) */
  sectionPath: string
}

export interface OutlookItem {
  no: number
  category: OutlookCategory
  /** 화면 이름(투자·설비 등) */
  categoryLabel: string
  /** AI가 줄인 요지 */
  summary: string
  /** 원문 글 그대로(이어진 공백은 한 칸) */
  quote: string
  evidence: OutlookEvidence
}

export interface CompanyOutlook {
  corpCode: string
  status: OutlookStatus
  /** NOT_AVAILABLE일 때만 */
  reason: OutlookUnavailableReason | null
  /** GENERATED가 아니면 안내 */
  message: string | null
  /** 사업보고서가 없으면 null */
  report: BriefingReport | null
  /** GENERATED일 때만 항목이 있다 */
  items: OutlookItem[]
  aiGenerated: boolean
  ai: BriefingAi | null
}

/**
 * 회사가 밝힌 전망·계획. 저장된 것이 없으면 서버가 이 요청 안에서 만든다(동기, 처음엔 수십 초 걸릴 수 있음).
 * 화면을 떠나면 취소한다(서버는 끝까지 만들어 저장하므로 다시 열면 바로 보인다).
 */
export function getCompanyOutlook(corpCode: string, signal?: AbortSignal): Promise<CompanyOutlook> {
  return apiGet(endpoints.companyOutlook(corpCode), undefined, { signal })
}
