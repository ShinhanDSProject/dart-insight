import { match } from 'ts-pattern'
import type { TextChangeItem, TextChangeList } from '@/shared/api/textChanges'

/** '더 보기'(다음 쪽) 상태 */
export type MoreState = { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: unknown }

/** 문장 변화 목록. items는 지금까지 받은 모든 쪽, data는 마지막으로 받은 쪽 */
export type TextListState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown }
  | { status: 'success'; data: TextChangeList; items: TextChangeItem[]; more: MoreState }

export type TextListAction =
  | { type: 'load-start' }
  | { type: 'load-success'; data: TextChangeList }
  | { type: 'load-failure'; error: unknown }
  | { type: 'more-start' }
  | { type: 'more-success'; data: TextChangeList }
  | { type: 'more-failure'; error: unknown }

const MORE_IDLE: MoreState = { status: 'idle' }

/**
 * 첫 쪽 응답은 첫 쪽을 불러오는 중일 때만, 다음 쪽 응답은 '더 보기' 중일 때만 받는다.
 * 거르기·정렬을 바꿔 다시 불러오면 늦게 온 '더 보기' 응답이 새 목록을 덮지 않는다.
 */
export function textListReducer(state: TextListState, action: TextListAction): TextListState {
  return match<TextListAction, TextListState>(action)
    .with({ type: 'load-start' }, () => (state.status === 'loading' ? state : { status: 'loading' }))
    .with({ type: 'load-success' }, ({ data }) =>
      state.status === 'loading' ? { status: 'success', data, items: data.items, more: MORE_IDLE } : state,
    )
    .with({ type: 'load-failure' }, ({ error }) => (state.status === 'loading' ? { status: 'error', error } : state))
    .with({ type: 'more-start' }, () =>
      state.status === 'success' && state.more.status !== 'loading' ? { ...state, more: { status: 'loading' } } : state,
    )
    .with({ type: 'more-success' }, ({ data }) =>
      isLoadingMore(state) ? { status: 'success', data, items: [...state.items, ...data.items], more: MORE_IDLE } : state,
    )
    .with({ type: 'more-failure' }, ({ error }) => (isLoadingMore(state) ? { ...state, more: { status: 'error', error } } : state))
    .exhaustive()
}

function isLoadingMore(state: TextListState): state is Extract<TextListState, { status: 'success' }> {
  return state.status === 'success' && state.more.status === 'loading'
}
