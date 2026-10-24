import { describe, expect, it } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { TextChangeItem } from '@/shared/api/textChanges'
import { initialPinnedList, isMissingChange, pinnedIdsToFetch, pinnedListReducer, pinnedView, type PinnedListState } from './pinnedList'

const item = (changeId: number) => ({ changeId }) as TextChangeItem
const loading = pinnedListReducer(initialPinnedList, { type: 'fetch-start' })

function apiError(status: number, code: string): ApiError {
  return new ApiError(status, { code, message: '오류', traceId: null, errors: [] })
}

describe('pinnedListReducer', () => {
  it('받은 항목은 남기고, 이 분석에 없는 번호는 따로 모은다', () => {
    const done = pinnedListReducer(loading, { type: 'fetch-success', items: [item(3), item(1)], gone: [9] })
    expect([...done.loaded.keys()]).toEqual([3, 1])
    expect(done.gone).toEqual([9])
    expect(done.request).toEqual({ status: 'idle' })
  })

  it('일부만 받고 실패하면 받은 항목은 남기고 오류를 둔다', () => {
    const failed = pinnedListReducer(loading, { type: 'fetch-failure', items: [item(3)], gone: [], error: 'net' })
    expect(failed.loaded.has(3)).toBe(true)
    expect(failed.request).toEqual({ status: 'error', error: 'net' })
  })

  it('받는 중이 아닐 때 온 응답은 버린다', () => {
    expect(pinnedListReducer(initialPinnedList, { type: 'fetch-success', items: [item(3)], gone: [] })).toBe(initialPinnedList)
  })

  it('이미 받는 중이면 다시 시작해도 그대로다', () => {
    expect(pinnedListReducer(loading, { type: 'fetch-start' })).toBe(loading)
  })
})

describe('pinnedIdsToFetch·pinnedView', () => {
  const state: PinnedListState = { loaded: new Map([[3, item(3)], [1, item(1)]]), gone: [9], request: { status: 'idle' } }

  it('받지 않았고 없다고 확인되지도 않은 번호만 받는다', () => {
    expect(pinnedIdsToFetch([5, 3, 9, 1], state)).toEqual([5])
  })

  it('다 받았으면 고정한 순서로 보여 주고, 없는 번호는 빼서 건수가 맞다', () => {
    expect(pinnedView([1, 9, 3], state)).toEqual({ status: 'success', items: [item(1), item(3)] })
  })

  it('고정을 풀면 다시 받지 않고 목록에서만 뺀다', () => {
    expect(pinnedIdsToFetch([3], state)).toEqual([])
    expect(pinnedView([3], state)).toEqual({ status: 'success', items: [item(3)] })
  })

  it('고정한 것이 없으면 빈 목록이다', () => {
    expect(pinnedView([], initialPinnedList)).toEqual({ status: 'success', items: [] })
  })

  it('받을 것이 남았으면 불러오는 중, 실패했으면 오류다', () => {
    expect(pinnedView([5, 3], state)).toEqual({ status: 'loading' })
    expect(pinnedView([5, 3], { ...state, request: { status: 'error', error: 'net' } })).toEqual({ status: 'error', error: 'net' })
  })
})

describe('isMissingChange', () => {
  it('이 분석에 없는 변경 번호라는 응답만 고정에서 뺄 대상으로 본다', () => {
    expect(isMissingChange(apiError(404, 'ANALYSIS_TEXT_CHANGE_NOT_FOUND'))).toBe(true)
    expect(isMissingChange(apiError(404, 'ANALYSIS_NOT_FOUND'))).toBe(false)
    expect(isMissingChange(apiError(500, 'COMMON_INTERNAL_ERROR'))).toBe(false)
    expect(isMissingChange(new Error('net'))).toBe(false)
  })
})
