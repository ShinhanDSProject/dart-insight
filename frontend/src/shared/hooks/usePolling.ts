import { useCallback, useEffect, useReducer, useState } from 'react'
import { nextPollingDelay, POLLING_START, pollingReducer, type PollingAction, type PollingOptions, type PollingState } from './pollingState'
import type { Loader } from './useAsync'

export interface PollingResult<T> {
  state: PollingState<T>
  /** 처음부터 다시 조회한다(멈춘 뒤 '다시 시도') */
  restart: () => void
}

/**
 * load를 주기적으로 부른다. 응답이 온 뒤에 다음 조회를 예약하므로 요청이 겹치지 않는다.
 * load가 바뀌거나 restart하면 처음부터 다시 조회하고, 언마운트하면 예약을 지우고 요청을 취소한다(ST-5).
 * options는 렌더마다 새로 만들지 않는다(모듈 상수로 둔다).
 */
export function usePolling<T>(load: Loader<T>, options: PollingOptions<T>): PollingResult<T> {
  const [state, dispatch] = useReducer(pollingReducer<T>, POLLING_START)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    // reducer가 순수 함수이므로 같은 전이를 여기서도 따라가며 다음 조회 시점을 정한다
    let current: PollingState<T> = POLLING_START
    const apply = (action: PollingAction<T>) => {
      current = pollingReducer(current, action)
      dispatch(action)
    }
    const schedule = () => {
      const delay = nextPollingDelay(current, options)
      if (delay !== null) timer = setTimeout(poll, delay)
    }
    const poll = () => {
      load(controller.signal).then(
        (data) => {
          if (controller.signal.aborted) return
          apply({ type: 'receive', data })
          schedule()
        },
        (error: unknown) => {
          if (controller.signal.aborted) return
          apply({ type: 'fail', error, fatal: options.isFatal(error), maxFailures: options.maxFailures })
          schedule()
        },
      )
    }

    apply({ type: 'restart' })
    poll()
    return () => {
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [load, options, attempt])

  const restart = useCallback(() => setAttempt((n) => n + 1), [])
  return { state, restart }
}
