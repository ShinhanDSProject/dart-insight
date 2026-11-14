import { describe, expect, it } from 'vitest'
import type { ChatMessageResponse } from '@/shared/api/agentChat'
import { RISK_QUESTION } from './askQuestion'
import {
  CHAT_EXAMPLES,
  chatExamples,
  chatMessageOf,
  chatReducer,
  confirmKey,
  historyOf,
  initialChatState,
  type ChatExchange,
} from './chatState'

const response = (answer: string | null, message: string | null = null): ChatMessageResponse => ({
  status: answer === null ? 'NOT_FOUND' : 'ANSWERED',
  answer,
  message,
  citations: [],
  actions: [],
  format: 'CHAT',
  crossCheck: null,
  questionId: null,
  aiGenerated: answer !== null,
  ai: null,
  generalExplanation: false,
})

describe('chatReducer', () => {
  it('보내면 입력창을 비우고, 답이 오면 대화에 쌓는다', () => {
    const sending = chatReducer({ ...initialChatState, draft: '소송' }, { type: 'send', message: '소송 관련 변경' })
    expect(sending.draft).toBe('')
    expect(sending.request).toEqual({ status: 'sending', message: '소송 관련 변경' })
    const answered = chatReducer(sending, { type: 'answer', response: response('1건이에요[1].') })
    expect(answered.request.status).toBe('idle')
    expect(answered.exchanges.map((e) => [e.id, e.message])).toEqual([[1, '소송 관련 변경']])
  })

  it('저장을 마친 확인 버튼을 답 번호·액션 순서로 한 번만 기억한다', () => {
    const key = confirmKey(2, 0)
    const once = chatReducer(initialChatState, { type: 'confirmed', key })
    expect(once.confirmed).toEqual(['2:0'])
    expect(chatReducer(once, { type: 'confirmed', key })).toBe(once)
  })

  it('보내는 중이 아니면 늦게 온 답·실패를 버린다', () => {
    expect(chatReducer(initialChatState, { type: 'answer', response: response('답') })).toBe(initialChatState)
    expect(chatReducer(initialChatState, { type: 'fail', error: new Error('x') })).toBe(initialChatState)
  })

  it('기다리다 중단하면 보낸 글을 입력창에 돌려놓고, 늦게 온 답은 버린다', () => {
    const sending = chatReducer(initialChatState, { type: 'send', message: '영업이익' })
    const cancelled = chatReducer(sending, { type: 'cancel' })
    expect(cancelled.request).toEqual({ status: 'idle' })
    expect(cancelled.draft).toBe('영업이익')
    expect(chatReducer(cancelled, { type: 'answer', response: response('늦은 답') })).toBe(cancelled)
    expect(chatReducer(initialChatState, { type: 'cancel' })).toBe(initialChatState)
  })

  it('실패하면 보낸 메시지를 남겨 다시 보낼 수 있게 한다', () => {
    const sending = chatReducer(initialChatState, { type: 'send', message: '영업이익' })
    const failed = chatReducer(sending, { type: 'fail', error: 'boom' })
    expect(failed.request).toEqual({ status: 'error', message: '영업이익', error: 'boom' })
  })
})

describe('chatExamples', () => {
  it('이 분석의 계정 원인 질문을 맨 앞에 두고 고정 예시·위험 요인 질문을 잇는다. 긴 섹션 질문은 넣지 않는다', () => {
    const suggestions = ['매출액은 왜 늘었나요?', "'XI. 그 밖에 투자자 보호를 위하여 필요한 사항'에서 무엇이 바뀌었나요?", RISK_QUESTION, '매출총이익은 왜 늘었나요?']

    expect(chatExamples(suggestions)).toEqual(['매출액은 왜 늘었나요?', ...CHAT_EXAMPLES, RISK_QUESTION])
  })

  it('분석별 질문이 없으면 고정 예시와 위험 요인 질문만 보인다', () => {
    expect(chatExamples([])).toEqual([...CHAT_EXAMPLES, RISK_QUESTION])
    expect(chatExamples([RISK_QUESTION])).toEqual([...CHAT_EXAMPLES, RISK_QUESTION])
  })
})

describe('chatMessageOf', () => {
  it('앞뒤 공백을 뺀 2~500자만 보낼 수 있다', () => {
    expect(chatMessageOf('  소송  ')).toBe('소송')
    expect(chatMessageOf(' 가 ')).toBeNull()
    expect(chatMessageOf('가'.repeat(501))).toBeNull()
  })
})

describe('historyOf', () => {
  it('최근 6개만 오래된 것부터 보내고, 답의 근거 표시는 빼며 답이 없으면 안내 문구를 보낸다', () => {
    const exchanges: ChatExchange[] = [1, 2, 3, 4].map((id) => ({
      id,
      message: `질문 ${id}`,
      response: id === 4 ? response(null, '확인된 설명 없음') : response(`답 ${id}이에요[1].`),
    }))
    expect(historyOf(exchanges)).toEqual([
      { role: 'user', text: '질문 2' },
      { role: 'assistant', text: '답 2이에요.' },
      { role: 'user', text: '질문 3' },
      { role: 'assistant', text: '답 3이에요.' },
      { role: 'user', text: '질문 4' },
      { role: 'assistant', text: '확인된 설명 없음' },
    ])
  })

  it('한 턴은 1,500자까지로 자른다(정리 형식 답 상한과 같음)', () => {
    const [user] = historyOf([{ id: 1, message: '가'.repeat(1800), response: response('답') }])
    expect(user.text).toHaveLength(1500)
  })
})
