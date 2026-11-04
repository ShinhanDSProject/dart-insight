import type { ChatMessageResponse, ChatTurn } from '@/shared/api/agentChat'

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
export const MAX_TURN = 1000

/** 대화가 없을 때 보이는 예시 요청. 이 분석에서 만든 예시 질문 뒤에 붙인다 */
export const CHAT_EXAMPLES = ['소송 관련 변경 보여줘', '영업이익 어디 있어?', '사업의 내용 열어줘']

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
