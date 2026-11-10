import { apiGet } from './client'
import { endpoints } from './endpoints'

/** docs/api-spec.md GET /api/analyses/{analysisId}/activities (ADR-0067) */
export type ActivityStatus = 'GENERATED' | 'EMPTY' | 'REVIEW_NEEDED' | 'NOT_AVAILABLE'

/** NOT_AVAILABLE의 사유 */
export type ActivityUnavailableReason = 'TEXT_NOT_COMPARED'

export type ActivityArea = 'BUSINESS' | 'INVESTMENT' | 'FINANCE' | 'SHAREHOLDER' | 'GOVERNANCE' | 'PEOPLE' | 'RISK' | 'OTHER'

/** 쓰임: 투자(사모펀드·재무적 투자 포함), 취업·면접, 협업·거래 */
export type ActivityAudience = 'INVESTOR' | 'CAREER' | 'PARTNER'

/** 신호는 코드가 기준표로 붙인 값(ADR-0060). 투자 판단이 아니다 */
export type ActivitySignal = 'POSITIVE' | 'CAUTION' | 'HOLD'

export type ActivityHoldReason = 'NO_CRITERIA' | 'MIXED_SIDES' | 'EVIDENCE_NOT_CONFIRMED'

/** DISCLOSED 회사가 밝힌 계획·전망, OUTLOOK AI 전망(조건형), CHECK 다음에 확인할 점 */
export type ActivityImpactKind = 'DISCLOSED' | 'OUTLOOK' | 'CHECK'

export type ActivityImpactTone = 'GOOD' | 'BAD'

export interface ActivityEvidence {
  evidenceId: string
  rceptNo: string
  blockNo: number | null
  side: 'PREVIOUS' | 'CURRENT'
  sectionPath: string
  /** 그 인용이 든 문장 변경(전체 변경 탭의 tc) */
  changeId: number | null
}

export interface ActivityQuote {
  quote: string
  evidence: ActivityEvidence
}

export interface ActivityImpact {
  kind: ActivityImpactKind
  /** OUTLOOK만 GOOD·BAD, 그 밖에는 null */
  tone: ActivityImpactTone | null
  text: string
  premises: ActivityQuote[]
}

export interface ActivityItem {
  no: number
  area: ActivityArea
  audiences: ActivityAudience[]
  title: string
  summary: string
  facts: ActivityQuote[]
  signal: ActivitySignal
  holdReason: ActivityHoldReason | null
  signalKind: string
  signalKindName: string
  signalChange: string
  signalChangeName: string
  impacts: ActivityImpact[]
  changeIds: number[]
}

export interface ActivityOverview {
  text: string
  evidence: ActivityEvidence[]
}

export interface ActivityAi {
  model: string | null
  promptVersion: string
  generatedAt: string | null
}

export interface PeriodActivities {
  analysisId: number
  status: ActivityStatus
  reason: ActivityUnavailableReason | null
  message: string | null
  overview: ActivityOverview | null
  items: ActivityItem[]
  droppedCount: number
  candidateCount: number
  aiGenerated: boolean
  ai: ActivityAi | null
}

/**
 * 두 보고서 사이 활동과 앞으로의 영향. 저장된 것이 없으면 서버가 이 요청 안에서 만든다(동기, 처음엔 수십 초 걸릴 수 있음).
 * 화면을 떠나면 취소한다(서버는 끝까지 만들어 저장하므로 다시 열면 바로 보인다).
 */
export function getPeriodActivities(analysisId: number, signal?: AbortSignal): Promise<PeriodActivities> {
  return apiGet(endpoints.analysisActivities(analysisId), undefined, { signal })
}
