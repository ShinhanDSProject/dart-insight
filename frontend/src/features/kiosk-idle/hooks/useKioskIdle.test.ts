// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useKioskIdle } from './useKioskIdle'

describe('useKioskIdle', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('조작이 없으면 끝나기 15초 전부터 남은 초를 세고, 시간이 다 되면 한 번만 돌아간다', () => {
    const onIdle = vi.fn()
    const { result } = renderHook(() => useKioskIdle(60, onIdle))

    act(() => vi.advanceTimersByTime(44_000))
    expect(result.current.phase).toEqual({ status: 'active' })

    act(() => vi.advanceTimersByTime(1_000))
    expect(result.current.phase).toEqual({ status: 'warning', secondsLeft: 15 })

    act(() => vi.advanceTimersByTime(15_000))
    expect(result.current.phase).toEqual({ status: 'leave' })
    expect(onIdle).toHaveBeenCalledTimes(1)

    act(() => vi.advanceTimersByTime(5_000))
    expect(onIdle).toHaveBeenCalledTimes(1)
  })

  it('안내가 떠 있을 때 화면을 움직이면 바로 닫고 처음부터 다시 센다', () => {
    const onIdle = vi.fn()
    const { result } = renderHook(() => useKioskIdle(60, onIdle))

    act(() => vi.advanceTimersByTime(50_000))
    expect(result.current.phase.status).toBe('warning')

    act(() => {
      window.dispatchEvent(new Event('pointermove'))
    })
    expect(result.current.phase).toEqual({ status: 'active' })

    act(() => vi.advanceTimersByTime(44_000))
    expect(result.current.phase).toEqual({ status: 'active' })
    expect(onIdle).not.toHaveBeenCalled()
  })

  it("'계속 쓰기'(stay)를 누르면 다시 센다", () => {
    const onIdle = vi.fn()
    const { result } = renderHook(() => useKioskIdle(60, onIdle))

    act(() => vi.advanceTimersByTime(58_000))
    act(() => result.current.stay())
    expect(result.current.phase).toEqual({ status: 'active' })

    act(() => vi.advanceTimersByTime(30_000))
    expect(onIdle).not.toHaveBeenCalled()
  })
})
