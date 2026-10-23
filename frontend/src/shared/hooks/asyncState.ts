import { match } from 'ts-pattern'

/** 비동기 불러오기 상태(conventions.yaml ST-1). idle은 불러올 조건이 안 될 때(예: 검색어가 짧음) */
export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: unknown }

/** 불러올 조건이 늘 맞는 경우의 상태(idle 없음) */
export type LoadState<T> = Exclude<AsyncState<T>, { status: 'idle' }>

export type AsyncAction<T> =
  | { type: 'reset' }
  | { type: 'start' }
  | { type: 'resolve'; data: T }
  | { type: 'reject'; error: unknown }

export const IDLE = { status: 'idle' } as const
export const LOADING = { status: 'loading' } as const

/**
 * 불러오기 상태 전이. 응답(resolve·reject)은 불러오는 중일 때만 받는다.
 * 이미 끝났거나 초기화한 뒤에 늦게 온 응답은 버린다.
 */
export function asyncReducer<T>(state: AsyncState<T>, action: AsyncAction<T>): AsyncState<T> {
  return match<AsyncAction<T>, AsyncState<T>>(action)
    .with({ type: 'reset' }, () => (state.status === 'idle' ? state : IDLE))
    .with({ type: 'start' }, () => (state.status === 'loading' ? state : LOADING))
    .with({ type: 'resolve' }, ({ data }) => (state.status === 'loading' ? { status: 'success', data } : state))
    .with({ type: 'reject' }, ({ error }) => (state.status === 'loading' ? { status: 'error', error } : state))
    .exhaustive()
}
