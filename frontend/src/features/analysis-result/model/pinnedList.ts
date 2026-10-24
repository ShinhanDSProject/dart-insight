import { match } from 'ts-pattern'
import { ApiError } from '@/shared/api/client'
import type { TextChangeItem } from '@/shared/api/textChanges'

/**
 * '고정' 보기(3.3)의 목록. 목록 API는 번호로 거를 수 없어, 고정한 변경을 근거 상세(GET .../text-changes/{changeId})로 하나씩 받는다.
 * 한 번 받은 항목은 남겨 두고, 고정을 풀면 다시 받지 않고 목록에서만 뺀다. 이 분석에 없는 번호(404)는 gone에 모은다.
 */
export type PinnedRequest = { status: 'idle' } | { status: 'loading' } | { status: 'error'; error: unknown }

export interface PinnedListState {
  loaded: ReadonlyMap<number, TextChangeItem>
  gone: readonly number[]
  request: PinnedRequest
}

export type PinnedListAction =
  | { type: 'fetch-start' }
  | { type: 'fetch-success'; items: TextChangeItem[]; gone: number[] }
  /** 일부만 받았어도 받은 것은 남긴다 */
  | { type: 'fetch-failure'; items: TextChangeItem[]; gone: number[]; error: unknown }

export const initialPinnedList: PinnedListState = { loaded: new Map(), gone: [], request: { status: 'idle' } }

function merge(state: PinnedListState, items: TextChangeItem[], gone: number[]): Pick<PinnedListState, 'loaded' | 'gone'> {
  const loaded = new Map(state.loaded)
  for (const item of items) loaded.set(item.changeId, item)
  return { loaded, gone: [...state.gone, ...gone.filter((id) => !state.gone.includes(id))] }
}

/** 받는 중일 때만 응답을 받는다(취소한 뒤 늦게 온 응답은 버림) */
export function pinnedListReducer(state: PinnedListState, action: PinnedListAction): PinnedListState {
  return match<PinnedListAction, PinnedListState>(action)
    .with({ type: 'fetch-start' }, () => (state.request.status === 'loading' ? state : { ...state, request: { status: 'loading' } }))
    .with({ type: 'fetch-success' }, ({ items, gone }) =>
      state.request.status === 'loading' ? { ...merge(state, items, gone), request: { status: 'idle' } } : state,
    )
    .with({ type: 'fetch-failure' }, ({ items, gone, error }) =>
      state.request.status === 'loading' ? { ...merge(state, items, gone), request: { status: 'error', error } } : state,
    )
    .exhaustive()
}

/** 아직 받지 않았고 없다고 확인되지도 않은 고정 번호 */
export function pinnedIdsToFetch(ids: readonly number[], state: PinnedListState): number[] {
  return ids.filter((id) => !state.loaded.has(id) && !state.gone.includes(id))
}

export type PinnedView = { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'success'; items: TextChangeItem[] }

/** 화면에 그릴 상태. 항목은 고정한 순서(최근 고정 먼저)다 */
export function pinnedView(ids: readonly number[], state: PinnedListState): PinnedView {
  if (pinnedIdsToFetch(ids, state).length > 0) {
    return state.request.status === 'error' ? { status: 'error', error: state.request.error } : { status: 'loading' }
  }
  return { status: 'success', items: ids.flatMap((id) => state.loaded.get(id) ?? []) }
}

/** 이 분석에 없는 변경 번호라는 응답(고정에서 뺀다) */
export function isMissingChange(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'ANALYSIS_TEXT_CHANGE_NOT_FOUND'
}

/** '고정 N' 거르기와 빈 상태·안내 문구 */
export const PINNED_LABEL = '고정'
export const PINNED_EMPTY = '고정한 변경이 없어요. 카드의 고정 버튼으로 나중에 볼 변경을 모아 두세요.'
export const PINNED_NOTE = '고정한 변경은 이 브라우저에만 남아요. 최근에 고정한 것부터 보여 줘요.'
