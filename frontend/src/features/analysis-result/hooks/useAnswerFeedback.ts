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
 * 저장은 서버에 쓰는 요청이라 패널을 닫아도 취소하지 않는다. 앞 저장이 끝난 뒤 다음 저장을 보내
 * 서버에 누른 순서대로 남게 한다(동시에 보내면 늦게 끝난 앞 요청이 뒤 선택을 덮을 수 있음).
 *
 * @param initial 처음 평가. 새 답은 늘 null
 * @param save    평가를 저장한다(sendAnswerFeedback)
 */
export function useAnswerFeedback(initial: AnswerFeedback | null, save: (feedback: AnswerFeedback) => Promise<unknown>) {
  const [state, dispatch] = useReducer(answerFeedbackReducer, initial, initialFeedbackState)
  const seq = useRef(0)
  const queue = useRef<Promise<unknown>>(Promise.resolve())

  const choose = useCallback(
    (choice: FeedbackChoice) => {
      const feedback = nextFeedback(state.shown, choice)
      if (feedback === null) return
      seq.current += 1
      const mine = seq.current
      dispatch({ type: 'choose', feedback, seq: mine })
      // 실패해도 줄은 이어진다(then의 두 번째 인자가 실패를 받음)
      queue.current = queue.current
        .then(() => save(feedback))
        .then(
          () => dispatch({ type: 'saved', feedback, seq: mine }),
          () => dispatch({ type: 'fail', seq: mine }),
        )
    },
    [save, state.shown],
  )

  return { state, choose }
}
