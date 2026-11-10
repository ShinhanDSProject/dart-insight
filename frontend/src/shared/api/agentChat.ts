import type { GlossarySource } from './glossaryTerms'
import { apiPost } from './client'
import { endpoints } from './endpoints'
import type { DocumentSide } from './documents'
import type { SjDiv } from './results'
import type { AiInfo } from './summary'

/** docs/api-spec.md POST /api/analyses/{analysisId}/chat-messages (ADR-0044) */
export type ChatStatus = 'ANSWERED' | 'NOT_FOUND' | 'OUT_OF_SCOPE' | 'REVIEW_NEEDED' | 'INCOMPLETE'

/** 화면 맥락에 보낼 수 있는 탭(명세의 context.tab) */
export type ChatTab = 'summary' | 'financial' | 'text' | 'source'

export interface ChatTurn {
  role: 'user' | 'assistant'
  text: string
}

export interface ChatContext {
  tab?: ChatTab
  textChangeId?: number
  financialChangeId?: number
  side?: DocumentSide
  sectionNo?: number
}

export interface ChatMessageRequest {
  message: string
  history: ChatTurn[]
  context: ChatContext
}

export type ChatCitationKind =
  | 'BLOCK'
  | 'SECTION'
  | 'TEXT_CHANGE'
  | 'FINANCIAL_CHANGE'
  | 'DISCLOSURE'
  | 'REPORT_VALUE'
  | 'GLOSSARY'
  | 'COMPANY'

/** 답이 인용한 근거 하나. 답 안의 `[no]`가 가리킨다. 종류마다 채워지는 필드가 다르다(없는 필드는 응답에 없음) */
export interface ChatCitation {
  no: number
  kind: ChatCitationKind
  evidenceId: string
  changeId?: number
  changeType?: string
  side?: DocumentSide
  rceptNo?: string
  reportName?: string
  sectionNo?: number
  blockNo?: number
  sectionPath?: string
  /** 글 앞 160자 */
  quote?: string
  sjDiv?: SjDiv
  accountName?: string
  /** 코드가 저장된 계산 결과로 만든 사실 문장 */
  sentence?: string
  /** 저장된 재무 설명 등급. 없으면 이번에 새로 찾은 '관련 문장' */
  grade?: 'STATED' | 'RELATED'
  /** 수시공시 접수일(DISCLOSURE) */
  rceptDt?: string
  /** DART 원문 주소(DISCLOSURE·REPORT_VALUE) */
  dartUrl?: string
  /** 보고서 값의 출처(REPORT_VALUE) */
  source?: 'FINANCIAL_TREND' | 'KEY_FACT' | 'CHECKPOINT' | 'DISCLOSURE_KEY_ITEM'
  /** 항목 이름(REPORT_VALUE·COMPANY) */
  label?: string
  /** 그 API가 준 값 그대로(숫자 또는 글). REPORT_VALUE·COMPANY */
  value?: number | string
  unit?: string
  currency?: string
  /** 기업 근거(COMPANY) */
  corpCode?: string
  corpName?: string
  /** 용어 카드 근거(GLOSSARY, ADR-0061): 카드 키·용어·한 줄 뜻·출처 */
  termKey?: string
  term?: string
  definition?: string
  sources?: GlossarySource[]
}

/** 교차 검증 결과(코드가 정함, #581). 허위·오류 판정이 아니라 방향 대조 결과다 */
export type CrossCheckResult = 'CONSISTENT' | 'POTENTIAL_MISMATCH' | 'INSUFFICIENT_EVIDENCE' | 'NOT_COMPARABLE'

export interface ChatCrossCheck {
  result: CrossCheckResult
  reason: string
}

/** 화면 액션. type·label과 그 액션의 필드. 화면은 아는 종류만 실행하고 모르는 종류는 무시한다 */
export interface ChatAction {
  type: string
  label: string | null
  [field: string]: unknown
}

export interface ChatMessageResponse {
  status: ChatStatus
  /** 근거 표시가 [1]·[2]로 된 답. ANSWERED가 아니면 null */
  answer: string | null
  message: string | null
  citations: ChatCitation[]
  actions: ChatAction[]
  format: 'CHAT' | 'BRIEF'
  /** 교차 검증 요청일 때만. 답이 없어도(NOT_FOUND·REVIEW_NEEDED) 올 수 있다 */
  crossCheck: ChatCrossCheck | null
  questionId: number | null
  aiGenerated: boolean
  ai: AiInfo | null
  /** 카드도 보고서 설명도 없는 용어를 AI가 근거 없이 푼 일반 설명(ADR-0064). true면 citations는 빈 배열 */
  generalExplanation: boolean
}

/** 채팅 한 번. 동기 호출이고 Tool을 여러 번 부르면 수십 초 걸릴 수 있다 */
export function sendChatMessage(analysisId: number, body: ChatMessageRequest, signal?: AbortSignal): Promise<ChatMessageResponse> {
  return apiPost<ChatMessageResponse>(endpoints.chatMessages(analysisId), body, { signal })
}
