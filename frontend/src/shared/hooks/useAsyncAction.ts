import { useCallback, useReducer, useRef } from 'react'
import { asyncReducer, IDLE, type AsyncState } from './asyncState'

export interface AsyncActionResult<T> {
  state: AsyncState<T>
  /** 작업을 시작한다. 앞선 작업이 끝나기 전에 다시 부르면 앞선 결과는 버린다 */
  run: (task: () => Promise<T>) => Promise<void>
  /** 결과·오류를 지우고 idle로 되돌린다 */
  reset: () => void
}

/**
 * 버튼으로 시작하는 작업(분석 요청 등)의 상태(idle → loading → success | error).
 * 서버에 쓰는 요청이라 화면을 떠나도 취소하지 않는다(요청이 이미 서버에 닿았을 수 있음). 결과만 버린다.
 */
export function useAsyncAction<T>(): AsyncActionResult<T> {
  const [state, dispatch] = useReducer(asyncReducer<T>, IDLE)
  const latest = useRef(0)

  const run = useCallback(async (task: () => Promise<T>) => {
    latest.current += 1
    const id = latest.current
    dispatch({ type: 'start' })
    try {
      const data = await task()
      if (latest.current === id) dispatch({ type: 'resolve', data })
    } catch (error) {
      if (latest.current === id) dispatch({ type: 'reject', error })
    }
  }, [])

  const reset = useCallback(() => {
    latest.current += 1
    dispatch({ type: 'reset' })
  }, [])

  return { state, run, reset }
}
