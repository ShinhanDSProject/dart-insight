import { useCallback, useEffect, useReducer, useRef } from 'react'
import { askQuestion, getQuestions, sendAnswerFeedback, type AnswerFeedback } from '@/shared/api/questions'
import { useAsync } from '@/shared/hooks/useAsync'
import { parseQuestion } from '../model/askQuestion'
import { askReducer, initialAskState } from '../model/askState'

/**
 * AI 질문(3.10). 결과 화면 전체에서 하나만 두어, 다른 탭(원문 확인 등)에 다녀와도 받은 답과 보내는 질문이 남는다.
 * 기록(GET)은 언마운트·다시 불러오기 때 취소한다(useAsync, ST-5). 질문(POST)은 서버에 쓰는 요청이라 취소하지 않고,
 * 화면을 떠난 뒤 온 답은 버린다.
 */
export function useAsk(analysisId: number) {
  const [state, dispatch] = useReducer(askReducer, initialAskState)
  const loadHistory = useCallback((signal: AbortSignal) => getQuestions(analysisId, signal), [analysisId])
  const history = useAsync(loadHistory)
  const mounted = useRef(true)
  const sending = state.request.status === 'sending'

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    if (history.state.status === 'success') dispatch({ type: 'history', items: history.state.data.items })
  }, [history.state])

  const send = useCallback(
    (question: string, fromDraft: boolean) => {
      if (sending) return
      dispatch({ type: 'send', question, fromDraft })
      askQuestion(analysisId, question).then(
        (answer) => {
          if (mounted.current) dispatch({ type: 'answer', answer })
        },
        (error: unknown) => {
          if (mounted.current) dispatch({ type: 'fail', error })
        },
      )
    },
    [analysisId, sending],
  )

  /** 예시 질문을 바로 묻는다 */
  const ask = useCallback((question: string) => send(question, false), [send])

  /** 입력창 글을 보낸다. 짧으면 안내만 보이고, 길면(입력 중에 이미 안내함) 보내지 않는다 */
  const submitDraft = useCallback(() => {
    const input = parseQuestion(state.draft)
    if (input.kind === 'ready') send(input.question, true)
    else if (input.kind !== 'too-long') dispatch({ type: 'reject-draft' })
  }, [send, state.draft])

  /** 실패한 질문을 그대로 다시 보낸다 */
  const retry = useCallback(() => {
    if (state.request.status === 'error') send(state.request.question, state.request.fromDraft)
  }, [send, state.request])

  /** 답 평가를 저장하고(3.12) 저장되면 그 답에 적는다. 실패는 부른 쪽(답 카드)이 되돌린다 */
  const sendFeedback = useCallback(
    (questionId: number, feedback: AnswerFeedback) =>
      sendAnswerFeedback(analysisId, questionId, feedback).then((saved) => {
        if (mounted.current) {
          dispatch({ type: 'set-feedback', questionId, feedback: { helpful: saved.helpful, reason: saved.reason } })
        }
      }),
    [analysisId],
  )

  const setDraft = useCallback((draft: string) => dispatch({ type: 'set-draft', draft }), [])

  return { state, history, setDraft, submitDraft, ask, retry, sendFeedback }
}

export type AskController = ReturnType<typeof useAsk>
