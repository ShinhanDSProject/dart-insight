// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { TextEventList, TextEventRun } from '@/shared/api/textEvents'
import { useTextEvents } from './useTextEvents'

const api = vi.hoisted(() => ({ getCurrentEventRun: vi.fn(), startEventRun: vi.fn(), getTextEvents: vi.fn(), getTextEvent: vi.fn() }))
vi.mock('@/shared/api/textEvents', () => api)

const run = (status: TextEventRun['status'], notCreatedReason: TextEventRun['notCreatedReason'] = null) => ({ status, notCreatedReason }) as TextEventRun
const list = { items: [] } as unknown as TextEventList

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset())
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('useTextEvents', () => {
  it('실행이 없으면 시작하고, 끝나 있으면 사건을 받는다', async () => {
    api.getCurrentEventRun.mockResolvedValue(run('NOT_STARTED'))
    api.startEventRun.mockResolvedValue(run('COMPLETED'))
    api.getTextEvents.mockResolvedValue(list)

    const { result } = renderHook(() => useTextEvents(1))

    await waitFor(() => expect(result.current).toBe(list))
    expect(api.startEventRun).toHaveBeenCalledTimes(1)
  })

  it('이미 끝난 실행은 시작하지 않고 사건을 받는다', async () => {
    api.getCurrentEventRun.mockResolvedValue(run('COMPLETED'))
    api.getTextEvents.mockResolvedValue(list)

    const { result } = renderHook(() => useTextEvents(1))

    await waitFor(() => expect(result.current).toBe(list))
    expect(api.startEventRun).not.toHaveBeenCalled()
  })

  it('실패한 실행은 다시 시작하지 않고 사건을 부르지 않는다', async () => {
    api.getCurrentEventRun.mockResolvedValue(run('FAILED'))

    const { result } = renderHook(() => useTextEvents(1))

    await waitFor(() => expect(api.getCurrentEventRun).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve))
    expect(api.startEventRun).not.toHaveBeenCalled()
    expect(api.getTextEvents).not.toHaveBeenCalled()
    expect(result.current).toBeNull()
  })

  it('만들지 않은 분석은 사건을 부르지 않는다', async () => {
    api.getCurrentEventRun.mockResolvedValue(run('NOT_CREATED', 'DISABLED'))

    const { result } = renderHook(() => useTextEvents(1))

    await waitFor(() => expect(api.getCurrentEventRun).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve))
    expect(api.startEventRun).not.toHaveBeenCalled()
    expect(api.getTextEvents).not.toHaveBeenCalled()
    expect(result.current).toBeNull()
  })

  it('만드는 중이면 끝날 때까지 다시 묻고, 끝나면 사건을 받는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.getCurrentEventRun.mockResolvedValueOnce(run('RUNNING')).mockResolvedValue(run('COMPLETED'))
    api.getTextEvents.mockResolvedValue(list)

    const { result } = renderHook(() => useTextEvents(1))

    await waitFor(() => expect(api.getCurrentEventRun).toHaveBeenCalledTimes(1))
    expect(result.current).toBeNull()
    await vi.advanceTimersByTimeAsync(3000)
    await waitFor(() => expect(result.current).toBe(list))
    expect(api.getCurrentEventRun).toHaveBeenCalledTimes(2)
  })

  it('사건을 받지 못해도 오류를 올리지 않고 null이다', async () => {
    api.getCurrentEventRun.mockResolvedValue(run('COMPLETED'))
    api.getTextEvents.mockRejectedValue(new Error('실패'))

    const { result } = renderHook(() => useTextEvents(1))

    await waitFor(() => expect(api.getTextEvents).toHaveBeenCalled())
    expect(result.current).toBeNull()
  })
})
