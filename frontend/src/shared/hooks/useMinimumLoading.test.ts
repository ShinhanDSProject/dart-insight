// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMinimumLoading, useMinimumLoadingState } from './useMinimumLoading'

describe('useMinimumLoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('테스트 환경에서 forceInTest가 false이면 즉시 반영된다', () => {
    type TestState = { status: 'loading' } | { status: 'success'; data: string }
    const { result, rerender } = renderHook(
      ({ state, minMs }: { state: TestState; minMs: number }) => useMinimumLoadingState(state, minMs),
      {
        initialProps: { state: { status: 'loading' } as TestState, minMs: 1000 },
      },
    )

    expect(result.current.status).toBe('loading')

    rerender({ state: { status: 'success', data: 'hello' }, minMs: 1000 })
    expect(result.current.status).toBe('success')
    if (result.current.status === 'success') {
      expect(result.current.data).toBe('hello')
    }
  })

  it('forceInTest가 true이면 minDurationMs 이전에 완료되어도 남은 시간 동안 로딩 상태를 유지한다', () => {
    type TestState = { status: 'loading' } | { status: 'success'; data: string }
    const { result, rerender } = renderHook(
      ({ state, minMs }: { state: TestState; minMs: number }) =>
        useMinimumLoadingState(state, minMs, true),
      {
        initialProps: { state: { status: 'loading' } as TestState, minMs: 1000 },
      },
    )

    expect(result.current.status).toBe('loading')

    // 100ms 경과 후 완료 상태로 전환
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ state: { status: 'success', data: 'done' }, minMs: 1000 })

    // 아직 900ms 남았으므로 여전히 loading
    expect(result.current.status).toBe('loading')

    // 500ms 더 경과 (총 600ms)
    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.status).toBe('loading')

    // 400ms 더 경과 (총 1000ms 도달)
    act(() => {
      vi.advanceTimersByTime(400)
    })
    expect(result.current.status).toBe('success')
    if (result.current.status === 'success') {
      expect(result.current.data).toBe('done')
    }
  })

  it('처음부터 성공 상태로 마운트되면 지연 없이 즉시 표시된다', () => {
    type TestState = { status: 'loading' } | { status: 'success'; data: string }
    const { result } = renderHook(() =>
      useMinimumLoadingState<TestState>({ status: 'success', data: 'immediate' }, 1000, true),
    )

    expect(result.current.status).toBe('success')
    if (result.current.status === 'success') {
      expect(result.current.data).toBe('immediate')
    }
  })
})

describe('useMinimumLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('forceInTest가 true일 때 loading이 true에서 false로 바뀔 때 최소 시간 동안 true를 유지한다', () => {
    const { result, rerender } = renderHook(
      ({ loading, minMs }: { loading: boolean; minMs: number }) =>
        useMinimumLoading(loading, minMs, true),
      {
        initialProps: { loading: true, minMs: 800 },
      },
    )

    expect(result.current).toBe(true)

    // 50ms 후 loading=false
    act(() => {
      vi.advanceTimersByTime(50)
    })
    rerender({ loading: false, minMs: 800 })

    expect(result.current).toBe(true)

    // 700ms 더 경과 (총 750ms)
    act(() => {
      vi.advanceTimersByTime(700)
    })
    expect(result.current).toBe(true)

    // 50ms 더 경과 (총 800ms)
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(result.current).toBe(false)
  })
})
