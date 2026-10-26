import { useCallback, useEffect, useReducer, useRef } from 'react'
import { askCompanyQuestion, getCompanyQuestions } from '@/shared/api/companyQuestions'
import { useAsync } from '@/shared/hooks/useAsync'
import { parseQuestion } from '@/shared/lib/questionText'
import { companyAskReducer, initialCompanyAskState } from '../model/companyAsk'

/**
 * 사업보고서에 근거해 묻기(FS-53). 기록(GET)은 언마운트·기업이 바뀔 때 취소한다(useAsync, ST-5).
 * 질문(POST)은 서버에 쓰는 요청이라 취소하지 않고, 화면을 떠난 뒤 온 답은 버린다.
 */
export function useCompanyAsk(corpCode: string) {
  const [state, dispatch] = useReducer(companyAskReducer, initialCompanyAskState)
  const loadHistory = useCallback((signal: AbortSignal) => getCompanyQuestions(corpCode, signal), [corpCode])
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
      askCompanyQuestion(corpCode, question).then(
        (answer) => {
          if (mounted.current) dispatch({ type: 'answer', answer })
        },
        (error: unknown) => {
          if (mounted.current) dispatch({ type: 'fail', error })
        },
      )
    },
    [corpCode, sending],
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

  const setDraft = useCallback((draft: string) => dispatch({ type: 'set-draft', draft }), [])

  return { state, history, setDraft, submitDraft, ask, retry }
}
