import { useCallback, useEffect, useReducer, useRef } from 'react'
import { sendChatMessage, type ChatContext } from '@/shared/api/agentChat'
import { chatMessageOf, chatReducer, historyOf, initialChatState } from '../model/chatState'

/**
 * AI 에이전트 채팅(ADR-0044). 결과 화면 전체에서 하나만 두어 탭을 바꿔도 대화가 남는다(AC20).
 * 한 번에 하나만 보내고, 보낼 때마다 최근 대화(최대 6개)와 그때의 화면 맥락을 붙인다.
 * 화면을 떠나면 보내던 요청을 취소한다(ST-5). 기다리는 중에 사용자가 중단할 수도 있다(서버는 끝까지 처리할 수 있지만 화면은 풀린다).
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

  /** 기다리던 요청을 그만둔다. 보낸 글은 입력창에 돌아온다 */
  const cancel = useCallback(() => {
    controller.current?.abort()
    dispatch({ type: 'cancel' })
  }, [])

  const setDraft = useCallback((draft: string) => dispatch({ type: 'set-draft', draft }), [])

  /** 확인 버튼의 저장이 끝났다(confirmKey). 패널을 다시 열어도 저장한 결과로 보인다 */
  const markConfirmed = useCallback((key: string) => dispatch({ type: 'confirmed', key }), [])

  return { state, send, retry, cancel, setDraft, markConfirmed }
}

export type AgentChatController = ReturnType<typeof useAgentChat>
