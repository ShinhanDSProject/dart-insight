import type { ChatMessageResponse, ChatTurn } from '@/shared/api/agentChat'
import { RISK_QUESTION } from './askQuestion'

/**
 * AI 에이전트 채팅(ADR-0044)의 대화 상태(ST-2). 대화는 서버에 저장하지 않으므로 화면이 들고 있다가
 * 보낼 때마다 최근 몇 턴을 함께 보낸다. 한 번에 하나만 보낸다.
 */
export interface ChatExchange {
  /** 화면 안에서만 쓰는 번호(목록 key) */
  id: number
  message: string
  response: ChatMessageResponse
}

export type ChatRequest =
  | { status: 'idle' }
  | { status: 'sending'; message: string }
  | { status: 'error'; message: string; error: unknown }

export interface ChatState {
  exchanges: ChatExchange[]
  request: ChatRequest
  draft: string
  /** 저장을 마친 확인 버튼(confirmKey). 패널을 닫았다 열어도 다시 저장하지 않게 대화와 함께 둔다 */
  confirmed: string[]
}

export type ChatAction =
  | { type: 'set-draft'; draft: string }
  | { type: 'send'; message: string }
  | { type: 'answer'; response: ChatMessageResponse }
  | { type: 'fail'; error: unknown }
  | { type: 'confirmed'; key: string }

export const initialChatState: ChatState = { exchanges: [], request: { status: 'idle' }, draft: '', confirmed: [] }

/** 확인 버튼 하나를 가리키는 키: 답 번호와 그 답의 actions 안 순서 */
export function confirmKey(exchangeId: number, actionIndex: number): string {
  return `${exchangeId}:${actionIndex}`
}

/** 명세: 메시지는 앞뒤 공백을 뺀 2~500자, 최근 대화는 6개까지, 한 턴은 1,000자까지 */
export const MIN_MESSAGE = 2
export const MAX_MESSAGE = 500
export const MAX_HISTORY = 6
export const MAX_TURN = 1500

/** 대화가 없을 때 보이는 예시 요청. 이 분석에서 만든 예시 질문 뒤에 붙인다 */
/**
 * 에이전트가 잘하는 일을 보여 주는 고정 예시(사용자 결정 2026-11-11). 설명과 수치 대조(CROSS_CHECK), 용어 풀이(TERM, 공개 카드가 있는 용어),
 * 정리 형식(BRIEF, '3줄로 정리'), 변경 찾아 보여 주기 순이다
 */
export const CHAT_EXAMPLES = [
  '회사 설명과 재무 수치가 맞는지 확인해줘',
  '부채비율이 뭐예요?',
  '이번 변화를 3줄로 정리해줘',
  '소송 관련 변경 보여줘',
]
/** 채팅 패널에 보이는 예시 질문 수 */
export const CHAT_EXAMPLE_COUNT = 6

/**
 * 채팅 패널의 예시 질문. 이 분석의 첫 계정 원인 질문(CAUSE_TRACE, 예: '매출액은 왜 늘었나요?')을 맨 앞에 두고,
 * 고정 예시와 새 위험 요인 질문을 잇는다. 섹션 질문처럼 긴 분석별 질문은 넣지 않는다. 같은 질문은 한 번만 둔다
 */
export function chatExamples(suggestions: readonly string[]): string[] {
  const accountQuestion = suggestions.find((q) => q !== RISK_QUESTION && !q.startsWith("'"))
  const ordered = [accountQuestion, ...CHAT_EXAMPLES, RISK_QUESTION]
  return [...new Set(ordered.filter((q): q is string => q !== undefined))].slice(0, CHAT_EXAMPLE_COUNT)
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'set-draft':
      return { ...state, draft: action.draft }
    case 'send':
      return { ...state, request: { status: 'sending', message: action.message }, draft: '' }
    case 'answer': {
      if (state.request.status !== 'sending') return state
      const id = (state.exchanges.at(-1)?.id ?? 0) + 1
      const exchange: ChatExchange = { id, message: state.request.message, response: action.response }
      return { ...state, exchanges: [...state.exchanges, exchange], request: { status: 'idle' } }
    }
    case 'fail':
      if (state.request.status !== 'sending') return state
      return { ...state, request: { status: 'error', message: state.request.message, error: action.error } }
    case 'confirmed':
      return state.confirmed.includes(action.key) ? state : { ...state, confirmed: [...state.confirmed, action.key] }
  }
}

/** 보낼 수 있는 메시지면 앞뒤 공백을 뺀 글, 아니면 null */
export function chatMessageOf(draft: string): string | null {
  const message = draft.trim()
  return message.length >= MIN_MESSAGE && message.length <= MAX_MESSAGE ? message : null
}

/** 최근 대화(오래된 것부터, 최대 6개). 답은 근거 표시를 빼고 답이 없으면 안내 문구를 보낸다 */
export function historyOf(exchanges: ChatExchange[]): ChatTurn[] {
  const turns = exchanges.flatMap((e): ChatTurn[] => [
    { role: 'user', text: clip(e.message) },
    { role: 'assistant', text: clip(assistantText(e.response)) },
  ])
  return turns.filter((t) => t.text !== '').slice(-MAX_HISTORY)
}

function assistantText(response: ChatMessageResponse): string {
  return (response.answer ?? response.message ?? '').replace(/\[\d+\]/g, '').replace(/\s+/g, ' ').trim()
}

function clip(text: string): string {
  return text.length <= MAX_TURN ? text : text.slice(0, MAX_TURN)
}
