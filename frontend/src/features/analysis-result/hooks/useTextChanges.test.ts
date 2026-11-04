// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TextChangeList, TextField } from '@/shared/api/textChanges'
import { useTextChanges } from './useTextChanges'

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
