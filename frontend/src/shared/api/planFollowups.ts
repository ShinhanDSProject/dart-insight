import type { BriefingAi, BriefingReport } from './briefing'
import { apiGet } from './client'
import { endpoints } from './endpoints'
import type { OutlookCategory, OutlookEvidence } from './outlook'

/** docs/api-spec.md GET /api/companies/{corpCode}/plan-followups (1.10, FS-60, ADR-0041) */
export type PlanFollowupStatus = 'GENERATED' | 'EMPTY' | 'REVIEW_NEEDED' | 'NOT_AVAILABLE'

/** 대조를 만들지 않은 사유 */
export type PlanFollowupReason =
  | 'NO_REPORT'
  | 'NO_PREVIOUS_REPORT'
  | 'NO_PREVIOUS_SOURCE'
  | 'NO_DOCUMENT'
  | 'NO_CURRENT_SOURCE'
  | 'NO_PREVIOUS_PLAN'
  | 'PREVIOUS_REVIEW_NEEDED'

/** 계획 하나의 대조 상태. 평가가 아니라 올해 보고서에 관련 문장이 있는지다 */
export type FollowupStatus = 'MENTIONED' | 'CHANGED' | 'NOT_FOUND'

export interface PlanFollowupItem {
  planNo: number
  /** 시장·업황 전망(MARKET)은 오지 않는다 */
  category: Exclude<OutlookCategory, 'MARKET'>
  categoryLabel: string
  /** 작년 보고서의 계획(요지는 AI가 줄임, 인용은 원문 그대로) */
  plan: { summary: string; quote: string; evidence: OutlookEvidence }
  /** 올해 보고서의 관련 문단. NOT_FOUND면 summary·quote·evidence가 null */
  followup: {
    status: FollowupStatus
    statusLabel: string
    summary: string | null
    quote: string | null
    evidence: OutlookEvidence | null
  }
}

export interface CompanyPlanFollowups {
  corpCode: string
  status: PlanFollowupStatus
  reason: PlanFollowupReason | null
  /** GENERATED가 아니면 안내 */
  message: string | null
  previousReport: BriefingReport | null
  currentReport: BriefingReport | null
  /** GENERATED일 때만 계획마다 하나 */
  items: PlanFollowupItem[]
  aiGenerated: boolean
  ai: BriefingAi | null
}

/**
 * 약속과 실제 대조. 저장된 것이 없으면 서버가 이 요청 안에서 만든다(동기, 처음엔 수십 초 걸릴 수 있음).
 * 화면을 떠나면 취소한다(서버는 끝까지 만들어 저장하므로 다시 열면 바로 보인다).
 */
export function getCompanyPlanFollowups(corpCode: string, signal?: AbortSignal): Promise<CompanyPlanFollowups> {
  return apiGet(endpoints.companyPlanFollowups(corpCode), undefined, { signal })
}
