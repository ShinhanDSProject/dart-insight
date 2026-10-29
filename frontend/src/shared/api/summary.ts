import { apiGet } from './client'
import { endpoints } from './endpoints'
import type { DocumentSide } from './documents'
import type { SjDiv } from './results'
import type { TextStatus } from './textChanges'

/** docs/api-spec.md GET /api/analyses/{id}/summary */
export type SummaryStatus = 'COMPLETED' | 'PARTIAL' | 'EMPTY'
export type SummaryKind = 'FINANCIAL' | 'TEXT'
/** TEMPLATE: 검증에 실패한 설명 대신 코드가 정한 틀로 보임(#149). REVIEW_NEEDED: 분석 버전 m2-14 이하의 검증 실패 */
export type ExplanationStatus = 'FOUND' | 'NOT_FOUND' | 'TEMPLATE' | 'REVIEW_NEEDED'
/** 재무 수치 설명 등급(ADR-0015): 회사가 직접 밝힘, 관련 내용, 확인된 설명 없음 */
export type ExplanationGrade = 'STATED' | 'RELATED' | 'NONE'

/** 요약 한 줄을 묶는 투자자 관점(FS-64). 주제로 묶을 뿐 좋고 나쁨을 판단하지 않는다 */
export type SummaryLens = 'PROFITABILITY' | 'GROWTH' | 'STABILITY' | 'CASH_FLOW' | 'SHAREHOLDER' | 'RISK' | 'OTHER'

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
  lens: SummaryLens
  /** 관점의 화면 이름(예: 재무 안정성) */
  lensLabel: string
  /** 코드가 계산한 값으로 만든 사실 문장(재무 수치). 문장 변화면 null */
  factSentence: string | null
  /** AI가 만든 문장(문장 변화 요약, 재무 수치 설명) */
  aiText: string | null
  aiGenerated: boolean
  explanationStatus: ExplanationStatus | null
  /** 재무 수치 설명 등급. 문장 변화·검토 필요·등급 기능 전 분석이면 null */
  explanationGrade: ExplanationGrade | null
  /** 회사 공시에서 그대로 옮긴 인용문 */
  quote: string | null
  /** 인용 위치 */
  quoteEvidence: SummaryEvidence | null
  /** 코드가 설명 등급을 낮춘 사유. 낮추지 않았으면 null */
  gradeReason: string | null
  evidence: SummaryEvidence[]
  ai: AiInfo | null
}

export interface ReviewItem {
  itemNo: number
  kind: SummaryKind
  target: SummaryTarget
  lens: SummaryLens
  lensLabel: string
  reason: string | null
  /** 투자 권유성 표현 검사(5.5)에 걸린 규칙 ID. 근거 확인에 실패한 것이면 빈 목록 */
  blockedRules: string[]
}

/** 관점 하나의 보이는 줄(items) 수 */
export interface LensCount {
  lens: SummaryLens
  lensLabel: string
  count: number
}

export interface Summary {
  analysisId: number
  summaryStatus: SummaryStatus | null
  summaryMessage: string | null
  textStatus: TextStatus | null
  items: SummaryItem[]
  /** 일곱 관점을 정한 순서로 모두 준다(없으면 count 0) */
  lensCounts: LensCount[]
  reviewNeededCount: number
  reviewNeeded: ReviewItem[]
}

export function getSummary(analysisId: number, signal?: AbortSignal): Promise<Summary> {
  return apiGet(endpoints.summary(analysisId), undefined, { signal })
}
