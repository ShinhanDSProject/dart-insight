import { apiGet } from './client'
import { endpoints } from './endpoints'
import type { ReportType } from './reports'

/** docs/api-spec.md GET /api/companies/{corpCode}/briefing (1.2, FS-49, ADR-0025) */
export type BriefingStatus = 'GENERATED' | 'REVIEW_NEEDED' | 'NOT_AVAILABLE'

/** NOT_AVAILABLE의 사유 */
export type BriefingUnavailableReason = 'NO_REPORT' | 'NO_DOCUMENT' | 'NO_SOURCE'

export interface BriefingReport {
  rceptNo: string
  reportName: string
  reportType: ReportType
  dartUrl: string
}

/** 문장이 인용한 원문 위치 */
export interface BriefingEvidence {
  evidenceId: string
  rceptNo: string
  sectionNo: number
  blockNo: number
  /** 상위 목차부터 이은 제목(' > '로 이음) */
  sectionPath: string
  /** 인용 블록 앞 600자. 표는 행마다 한 줄, 셀은 ' | '로 이음 */
  quote: string
}

export interface BriefingSentence {
  no: number
  text: string
  evidence: BriefingEvidence[]
}

export interface BriefingAi {
  model: string | null
  promptVersion: string | null
  generatedAt: string | null
}

export interface CompanyBriefing {
  corpCode: string
  status: BriefingStatus
  /** NOT_AVAILABLE일 때만 */
  reason: BriefingUnavailableReason | null
  /** REVIEW_NEEDED·NOT_AVAILABLE일 때 안내 */
  message: string | null
  /** 정기보고서가 없으면 null */
  report: BriefingReport | null
  /** GENERATED일 때만 문장이 있다 */
  sentences: BriefingSentence[]
  aiGenerated: boolean
  ai: BriefingAi | null
}

/**
 * 기업 브리핑. 저장된 것이 없으면 서버가 이 요청 안에서 만든다(동기, 처음엔 수십 초 걸릴 수 있음).
 * 화면을 떠나면 취소한다(서버는 끝까지 만들어 저장하므로 다시 열면 바로 보인다).
 */
export function getCompanyBriefing(corpCode: string, signal?: AbortSignal): Promise<CompanyBriefing> {
  return apiGet(endpoints.companyBriefing(corpCode), undefined, { signal })
}
