import { useCallback, useEffect, useReducer, useState } from 'react'
import { asyncReducer, IDLE, LOADING, type AsyncState, type LoadState } from './asyncState'

/** 취소 신호를 받아 값을 불러오는 함수. 바뀔 때마다 다시 불러오므로 useCallback으로 감싸 넘긴다 */
export type Loader<T> = (signal: AbortSignal) => Promise<T>

export interface AsyncResult<S> {
  state: S
  /** 같은 조건으로 다시 불러온다('다시 시도') */
  reload: () => void
}

/**
 * 값을 불러와 상태(loading → success | error)로 돌려준다(conventions.yaml ST-4·5).
 * load가 바뀌거나 reload하면 이전 요청을 AbortController로 취소하고 다시 부른다. 언마운트할 때도 취소한다.
 * load가 null이면 부르지 않고 idle이다.
 */
export function useAsync<T>(load: Loader<T>): AsyncResult<LoadState<T>>
export function useAsync<T>(load: Loader<T> | null): AsyncResult<AsyncState<T>>
export function useAsync<T>(load: Loader<T> | null): AsyncResult<AsyncState<T>> {
  const [state, dispatch] = useReducer(asyncReducer<T>, load, initialState<T>)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (load === null) {
      dispatch({ type: 'reset' })
      return
    }
    const controller = new AbortController()
    dispatch({ type: 'start' })
    load(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) dispatch({ type: 'resolve', data })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) dispatch({ type: 'reject', error })
      },
    )
    return () => controller.abort()
  }, [load, attempt])

  const reload = useCallback(() => setAttempt((n) => n + 1), [])
  return { state: visibleState(load, state), reload }
}

/** 조건이 바뀐 첫 렌더에서도(effect가 돌기 전) 지금 조건에 맞는 상태를 보여 준다 */
function visibleState<T>(load: Loader<T> | null, state: AsyncState<T>): AsyncState<T> {
  if (load === null) return IDLE
  if (state.status === 'idle') return LOADING
  return state
}

function initialState<T>(load: Loader<T> | null): AsyncState<T> {
  return load === null ? IDLE : LOADING
}
