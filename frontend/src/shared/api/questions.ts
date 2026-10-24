import { apiGet, apiPost, apiPut } from './client'
import { endpoints } from './endpoints'
import type { DocumentSide } from './documents'
import type { SjDiv } from './results'
import type { AiInfo } from './summary'

/** docs/api-spec.md POST·GET /api/analyses/{id}/questions (3.10, ADR-0019) */
export type QuestionStatus = 'ANSWERED' | 'NOT_FOUND' | 'OUT_OF_SCOPE' | 'REVIEW_NEEDED'

/** 답이 인용한 원문 문단. 답 안의 `[no]`가 가리킨다 */
export interface QuestionCitation {
  no: number
  evidenceId: string
  side: DocumentSide
  rceptNo: string
  reportName: string
  sectionNo: number
  blockNo: number
  sectionPath: string
  /** 문단 앞 160자 */
  quote: string
}

/** 답이 인용한 사실(코드가 계산한 재무 수치 문장). 답 안의 `[ref]`(예: F1)가 가리킨다 */
export interface QuestionFact {
  ref: string
  changeId: number
  sjDiv: SjDiv
  accountName: string
  sentence: string
}

export interface QuestionAnswer {
  questionId: number
  question: string
  status: QuestionStatus
  /** ANSWERED일 때만. 그 밖은 null */
  answer: string | null
  /** 답하지 못한 사유 등 안내 */
  message: string | null
  citations: QuestionCitation[]
  facts: QuestionFact[]
  /** AI가 답을 만들었을 때만. NOT_FOUND·OUT_OF_SCOPE면 null */
  ai: AiInfo | null
  /** 이 답의 평가(3.12). 평가하지 않았으면 null */
  feedback: AnswerFeedback | null
  createdAt: string
}

/** 답이 도움이 안 된 사유. docs/api-spec.md PUT /api/analyses/{id}/questions/{questionId}/feedback (3.12, FS-9) */
export type FeedbackReason = 'WRONG_SOURCE' | 'NOT_ANSWERED' | 'HARD_TO_READ' | 'OTHER'

/** 답 평가. reason은 helpful이 false일 때만(아니면 null) */
export interface AnswerFeedback {
  helpful: boolean
  reason: FeedbackReason | null
}

export interface AnswerFeedbackResponse extends AnswerFeedback {
  questionId: number
  updatedAt: string
}

export interface QuestionHistory {
  items: QuestionAnswer[]
}

/** 근거로 답하는 질문(동기 호출, 보통 수 초). 서버에 쓰는 요청이라 화면을 떠나도 취소하지 않는다 */
export function askQuestion(analysisId: number, question: string): Promise<QuestionAnswer> {
  return apiPost(endpoints.questions(analysisId), { question })
}

/** 답(ANSWERED) 평가를 저장한다. 다시 보내면 덮어쓴다 */
export function sendAnswerFeedback(
  analysisId: number,
  questionId: number,
  body: AnswerFeedback,
): Promise<AnswerFeedbackResponse> {
  return apiPut(endpoints.questionFeedback(analysisId, questionId), body)
}

/** 이 분석에서 한 질문·답 기록(최신 순, 최대 20개) */
export function getQuestions(analysisId: number, signal?: AbortSignal): Promise<QuestionHistory> {
  return apiGet(endpoints.questions(analysisId), undefined, { signal })
}
