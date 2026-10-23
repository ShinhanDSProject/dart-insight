import { apiGet } from './client'
import { endpoints } from './endpoints'
import type { DocumentSide } from './documents'
import type { SjDiv } from './results'
import type { TextStatus } from './textChanges'

/** docs/api-spec.md GET /api/analyses/{id}/summary */
export type SummaryStatus = 'COMPLETED' | 'PARTIAL' | 'EMPTY'
export type SummaryKind = 'FINANCIAL' | 'TEXT'
export type ExplanationStatus = 'FOUND' | 'NOT_FOUND' | 'REVIEW_NEEDED'

export interface SummaryTarget {
  type: SummaryKind
  /** FINANCIAL이면 financial-changes의 changeId, TEXT면 text-changes의 changeId */
  changeId: number | null
  sjDiv: SjDiv | null
}

export interface SummaryEvidence {
  evidenceId: string
  /** 분석의 보고서가 아니면 null(열지 않음) */
  side: DocumentSide | null
  rceptNo: string | null
  sectionNo: number | null
  blockNo: number | null
}

export interface AiInfo {
  model: string | null
  promptVersion: string | null
  generatedAt: string | null
}

export interface SummaryItem {
  itemNo: number
  kind: SummaryKind
  target: SummaryTarget
  /** 코드가 계산한 값으로 만든 사실 문장(재무 수치). 문장 변화면 null */
  factSentence: string | null
  /** AI가 만든 문장(문장 변화 요약, 재무 수치 설명) */
  aiText: string | null
  aiGenerated: boolean
  explanationStatus: ExplanationStatus | null
  evidence: SummaryEvidence[]
  ai: AiInfo | null
}

export interface ReviewItem {
  itemNo: number
  kind: SummaryKind
  target: SummaryTarget
  reason: string | null
  /** 투자 권유성 표현 검사(5.5)에 걸린 규칙 ID. 근거 확인에 실패한 것이면 빈 목록 */
  blockedRules: string[]
}

export interface Summary {
  analysisId: number
  summaryStatus: SummaryStatus | null
  summaryMessage: string | null
  textStatus: TextStatus | null
  items: SummaryItem[]
  reviewNeededCount: number
  reviewNeeded: ReviewItem[]
}

export function getSummary(analysisId: number): Promise<Summary> {
  return apiGet(endpoints.summary(analysisId))
}
