import { useCallback, useReducer, useRef } from 'react'
import type { AnswerFeedback } from '@/shared/api/questions'
import {
  answerFeedbackReducer,
  initialFeedbackState,
  nextFeedback,
  type FeedbackChoice,
} from '../model/answerFeedback'

/**
 * 채팅 답 하나의 평가(3.12, AC21). 누르면 바로 보이고 저장에 실패하면 되돌린다(model/answerFeedback).
 * 저장은 서버에 쓰는 요청이라 패널을 닫아도 취소하지 않는다.
 *
 * @param initial 처음 평가. 새 답은 늘 null
 * @param save    평가를 저장한다(sendAnswerFeedback)
 */
export function useAnswerFeedback(initial: AnswerFeedback | null, save: (feedback: AnswerFeedback) => Promise<unknown>) {
  const [state, dispatch] = useReducer(answerFeedbackReducer, initial, initialFeedbackState)
  const seq = useRef(0)

  const choose = useCallback(
    (choice: FeedbackChoice) => {
      const feedback = nextFeedback(state.shown, choice)
      if (feedback === null) return
      seq.current += 1
      const mine = seq.current
      dispatch({ type: 'choose', feedback, seq: mine })
      save(feedback).then(
        () => dispatch({ type: 'saved', feedback, seq: mine }),
        () => dispatch({ type: 'fail', seq: mine }),
      )
    },
    [save, state.shown],
  )

  return { state, choose }
}
