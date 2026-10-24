import { useCallback, useEffect, useReducer, useRef } from 'react'
import { explainTextChange } from '@/shared/api/textChanges'
import { explanationOf, explanationReducer, initialExplanations, type ExplanationEntry } from '../model/textExplanation'

/**
 * 문장 카드마다의 AI 한 줄 풀이(3.11). 문장 변화 탭이 떠 있는 동안 받은 풀이를 남겨, 카드를 접었다 펴거나
 * 거르기를 바꿔도 다시 부르지 않는다. 카드마다 따로 부르므로 한 카드가 기다리는 동안 다른 카드도 쓸 수 있다.
 * 언마운트·분석이 바뀌면 보내던 요청을 취소한다(ST-5). 서버는 끝까지 만들어 저장하므로 다음에는 저장된 풀이가 온다.
 */
export function useTextExplanations(analysisId: number) {
  const [state, dispatch] = useReducer(explanationReducer, initialExplanations)
  // 보내는 중인 요청과 받은 풀이. 빠르게 두 번 눌러도 한 번만 부르도록 렌더링을 기다리지 않고 바로 본다
  const controllers = useRef(new Map<number, AbortController>())
  const done = useRef(new Set<number>())

  useEffect(() => {
    const inFlight = controllers.current
    const received = done.current
    return () => {
      inFlight.forEach((c) => c.abort())
      inFlight.clear()
      received.clear()
      dispatch({ type: 'reset' })
    }
  }, [analysisId])

  /** 처음이거나 실패했으면 부른다. 불러오는 중이거나 이미 받았으면 아무것도 하지 않는다 */
  const request = useCallback(
    (changeId: number) => {
      if (controllers.current.has(changeId) || done.current.has(changeId)) return
      const controller = new AbortController()
      controllers.current.set(changeId, controller)
      dispatch({ type: 'start', changeId })
      explainTextChange(analysisId, changeId, controller.signal)
        .then((data) => {
          if (controller.signal.aborted) return
          done.current.add(changeId)
          dispatch({ type: 'resolve', changeId, data })
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) dispatch({ type: 'reject', changeId, error })
        })
        .finally(() => {
          if (controllers.current.get(changeId) === controller) controllers.current.delete(changeId)
        })
    },
    [analysisId],
  )

  const entryOf = useCallback((changeId: number): ExplanationEntry => explanationOf(state, changeId), [state])

  return { entryOf, request }
}

export type TextExplanations = ReturnType<typeof useTextExplanations>
