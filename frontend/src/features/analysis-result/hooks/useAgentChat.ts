import { useCallback, useEffect, useReducer, useRef } from 'react'
import { sendChatMessage, type ChatContext } from '@/shared/api/agentChat'
import { chatMessageOf, chatReducer, historyOf, initialChatState } from '../model/chatState'

/**
 * AI 에이전트 채팅(ADR-0044). 결과 화면 전체에서 하나만 두어 탭을 바꿔도 대화가 남는다(AC20).
 * 한 번에 하나만 보내고, 보낼 때마다 최근 대화(최대 6개)와 그때의 화면 맥락을 붙인다.
 * 화면을 떠나면 보내던 요청을 취소한다(ST-5).
 */
export function useAgentChat(analysisId: number) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState)
  const controller = useRef<AbortController | null>(null)
  const sending = state.request.status === 'sending'

  useEffect(() => () => controller.current?.abort(), [])

  const send = useCallback(
    (raw: string, context: ChatContext) => {
      const message = chatMessageOf(raw)
      if (message === null || sending) return
      dispatch({ type: 'send', message })
      const current = new AbortController()
      controller.current = current
      sendChatMessage(analysisId, { message, history: historyOf(state.exchanges), context }, current.signal).then(
        (response) => {
          if (!current.signal.aborted) dispatch({ type: 'answer', response })
        },
        (error: unknown) => {
          if (!current.signal.aborted) dispatch({ type: 'fail', error })
        },
      )
    },
    [analysisId, sending, state.exchanges],
  )

  /** 실패한 메시지를 그대로 다시 보낸다 */
  const retry = useCallback(
    (context: ChatContext) => {
      if (state.request.status === 'error') send(state.request.message, context)
    },
    [send, state.request],
  )

  const setDraft = useCallback((draft: string) => dispatch({ type: 'set-draft', draft }), [])

  return { state, send, retry, setDraft }
}

export type AgentChatController = ReturnType<typeof useAgentChat>
