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

export type ChatCitationKind = 'BLOCK' | 'SECTION' | 'TEXT_CHANGE' | 'FINANCIAL_CHANGE' | 'DISCLOSURE' | 'REPORT_VALUE' | 'COMPANY'

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
  crossCheck: unknown
  questionId: number | null
  aiGenerated: boolean
  ai: AiInfo | null
}

/** 채팅 한 번. 동기 호출이고 Tool을 여러 번 부르면 수십 초 걸릴 수 있다 */
export function sendChatMessage(analysisId: number, body: ChatMessageRequest, signal?: AbortSignal): Promise<ChatMessageResponse> {
  return apiPost<ChatMessageResponse>(endpoints.chatMessages(analysisId), body, { signal })
}
