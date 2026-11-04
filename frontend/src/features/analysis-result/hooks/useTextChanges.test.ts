// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TextChangeList, TextField, TextSort } from '@/shared/api/textChanges'
import { useTextChangeGroup, useTextChanges } from './useTextChanges'

const api = vi.hoisted(() => ({ getTextChanges: vi.fn() }))
vi.mock('@/shared/api/textChanges', () => ({ getTextChanges: api.getTextChanges }))

const counts = { all: 1, added: 0, deleted: 0, modified: 1, numericUpdate: 0, moved: 0, reviewNeeded: 0 }

function response(listVersion: string | null): TextChangeList {
  return {
    page: 0,
    totalItems: 0,
    items: [],
    counts: { ...counts },
    riskCounts: { ...counts },
    sections: [],
    listVersion,
    fieldCounts: listVersion === null ? null : { LITIGATION: 1 },
    missingFields: listVersion === null ? null : [],
  } as unknown as TextChangeList
}

const filter = { type: null, sort: 'priority', section: null, q: null, risk: false } as const

beforeEach(() => {
  api.getTextChanges.mockReset()
})
afterEach(cleanup)

describe('useTextChanges 기본 목록(3.29)', () => {
  it('거르지 않으면 기본 목록 묶음으로 부르고, 검색하면 묶음 없이 불러 접힌 변경도 찾는다', async () => {
    api.getTextChanges.mockResolvedValue(response('text-list-1'))
    const { rerender } = renderHook(({ q }: { q: string | null }) => useTextChanges(1, { ...filter, q, field: null }), {
      initialProps: { q: null as string | null },
    })
    await waitFor(() => expect(api.getTextChanges).toHaveBeenLastCalledWith(1, expect.objectContaining({ groups: ['MAIN', 'UNPAIRED'] }), expect.anything()))
    rerender({ q: '소송' })
    await waitFor(() => expect(api.getTextChanges).toHaveBeenLastCalledWith(1, expect.objectContaining({ q: '소송', groups: [] }), expect.anything()))
  })

  it('다시 그려도 조건이 같으면 다시 부르지 않는다', async () => {
    api.getTextChanges.mockResolvedValue(response('text-list-1'))
    const { result, rerender } = renderHook(() => useTextChanges(1, { ...filter, field: null }))
    await waitFor(() => expect(result.current.state.status).toBe('success'))
    rerender()
    expect(api.getTextChanges).toHaveBeenCalledTimes(1)
  })

  it('받은 묶음 건수를 listing에 남긴다', async () => {
    api.getTextChanges.mockResolvedValue({ ...response('text-list-1'), groupCounts: { NOTE: 3 } })
    const { result } = renderHook(() => useTextChanges(1, { ...filter, field: null }))
    await waitFor(() => expect(result.current.listing?.groupCounts).toEqual({ NOTE: 3 }))
  })

  it('더 보기도 같은 묶음으로 다음 쪽을 부른다', async () => {
    api.getTextChanges.mockResolvedValue(response('text-list-1'))
    const { result } = renderHook(() => useTextChanges(1, { ...filter, field: null }))
    await waitFor(() => expect(result.current.state.status).toBe('success'))
    act(() => result.current.loadMore())
    expect(api.getTextChanges).toHaveBeenLastCalledWith(1, expect.objectContaining({ groups: ['MAIN', 'UNPAIRED'], page: 1 }), expect.anything())
    await waitFor(() => expect(result.current.state).toMatchObject({ more: { status: 'idle' } }))
  })
})

describe('useTextChangeGroup(3.29)', () => {
  it('그 묶음 하나만 부르고 정렬이 바뀌면 다시 부른다', async () => {
    api.getTextChanges.mockResolvedValue(response('text-list-1'))
    const { rerender } = renderHook(({ sort }: { sort: TextSort }) => useTextChangeGroup(1, 'NOTE', sort), { initialProps: { sort: 'priority' as TextSort } })
    await waitFor(() =>
      expect(api.getTextChanges).toHaveBeenLastCalledWith(1, expect.objectContaining({ groups: ['NOTE'], sort: 'priority', page: 0 }), expect.anything()),
    )
    rerender({ sort: 'document' })
    await waitFor(() => expect(api.getTextChanges).toHaveBeenLastCalledWith(1, expect.objectContaining({ groups: ['NOTE'], sort: 'document' }), expect.anything()))
  })

  it('실패하면 다시 시도할 수 있다', async () => {
    api.getTextChanges.mockRejectedValueOnce(new Error('실패'))
    const { result } = renderHook(() => useTextChangeGroup(1, 'NOTE', 'priority'))
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    api.getTextChanges.mockResolvedValueOnce(response('text-list-1'))
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.state.status).toBe('success'))
  })
})

describe('useTextChanges 분야(3.28)', () => {
  it('고른 분야를 목록 요청에 넣고, 바꾸면 다시 부른다', async () => {
    api.getTextChanges.mockResolvedValue(response('text-list-1'))
    const { rerender } = renderHook(({ field }: { field: TextField | null }) => useTextChanges(1, { ...filter, field }), {
      initialProps: { field: null as TextField | null },
    })
    await waitFor(() => expect(api.getTextChanges).toHaveBeenLastCalledWith(1, expect.objectContaining({ field: null }), expect.anything()))
    rerender({ field: 'AUDIT' })
    await waitFor(() => expect(api.getTextChanges).toHaveBeenLastCalledWith(1, expect.objectContaining({ field: 'AUDIT' }), expect.anything()))
  })

  it('첫 응답 전에는 분야 건수가 없고, 응답을 받으면 생긴다', async () => {
    api.getTextChanges.mockResolvedValue(response('text-list-1'))
    const { result } = renderHook(() => useTextChanges(1, { ...filter, field: null }))
    expect(result.current.listing).toBeNull()
    await waitFor(() => expect(result.current.listing?.listVersion).toBe('text-list-1'))
    expect(result.current.listing?.fieldCounts).toEqual({ LITIGATION: 1 })
  })

  it('다시 불러오다 실패해도 받아 둔 분야 건수는 그대로 둔다', async () => {
    api.getTextChanges.mockResolvedValueOnce(response('text-list-1'))
    const { result, rerender } = renderHook(({ field }: { field: TextField | null }) => useTextChanges(1, { ...filter, field }), {
      initialProps: { field: null as TextField | null },
    })
    await waitFor(() => expect(result.current.listing).not.toBeNull())
    api.getTextChanges.mockRejectedValueOnce(new Error('실패'))
    rerender({ field: 'AUDIT' })
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.listing?.listVersion).toBe('text-list-1')
  })

  it('첫 조회가 실패하면 분야 건수는 모르는 채로 남는다(변경 없음으로 보지 않는다)', async () => {
    api.getTextChanges.mockRejectedValue(new Error('실패'))
    const { result } = renderHook(() => useTextChanges(1, { ...filter, field: null }))
    await waitFor(() => expect(result.current.state.status).toBe('error'))
    expect(result.current.listing).toBeNull()
  })
})
