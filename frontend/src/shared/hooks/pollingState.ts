import { match } from 'ts-pattern'

/**
 * 주기 조회 상태. failures는 연속 실패 횟수로, 실패해도 마지막으로 받은 값(data)은 계속 보여 준다.
 * error는 조회를 멈춘 상태다(바로 멈출 오류이거나 연속 실패가 한도에 닿음).
 */
export type PollingState<T> =
  | { status: 'loading'; failures: number }
  | { status: 'success'; data: T; failures: number }
  | { status: 'error'; error: unknown; data: T | null }

export type PollingAction<T> =
  | { type: 'restart' }
  | { type: 'receive'; data: T }
  | { type: 'fail'; error: unknown; fatal: boolean; maxFailures: number }

export interface PollingOptions<T> {
  /** 받은 값으로 조회를 이어 갈지. false면 멈춘다(예: 분석 완료·실패) */
  shouldContinue: (data: T) => boolean
  /** 다시 물어도 같을 오류인지(예: 4xx). true면 바로 멈춘다 */
  isFatal: (error: unknown) => boolean
  /** 연속 실패가 이 횟수에 닿으면 멈춘다 */
  maxFailures: number
  /** 연속 실패 횟수에 따른 다음 조회까지 기다릴 시간(ms) */
  delay: (failures: number) => number
}

export const POLLING_START = { status: 'loading', failures: 0 } as const

export function pollingReducer<T>(state: PollingState<T>, action: PollingAction<T>): PollingState<T> {
  return match<PollingAction<T>, PollingState<T>>(action)
    .with({ type: 'restart' }, () => POLLING_START)
    .with({ type: 'receive' }, ({ data }) => (state.status === 'error' ? state : { status: 'success', data, failures: 0 }))
    .with({ type: 'fail' }, ({ error, fatal, maxFailures }) =>
      match<PollingState<T>, PollingState<T>>(state)
        .with({ status: 'error' }, (stopped) => stopped)
        .with({ status: 'loading' }, ({ failures }) =>
          fatal || failures + 1 >= maxFailures ? { status: 'error', error, data: null } : { status: 'loading', failures: failures + 1 },
        )
        .with({ status: 'success' }, ({ data, failures }) =>
          fatal || failures + 1 >= maxFailures ? { status: 'error', error, data } : { status: 'success', data, failures: failures + 1 },
        )
        .exhaustive(),
    )
    .exhaustive()
}

/** 다음 조회까지 기다릴 시간(ms). 멈출 때는 null */
export function nextPollingDelay<T>(state: PollingState<T>, options: PollingOptions<T>): number | null {
  return match(state)
    .with({ status: 'error' }, () => null)
    .with({ status: 'success', failures: 0 }, ({ data }) => (options.shouldContinue(data) ? options.delay(0) : null))
    .with({ status: 'success' }, ({ failures }) => options.delay(failures))
    .with({ status: 'loading' }, ({ failures }) => options.delay(failures))
    .exhaustive()
}
