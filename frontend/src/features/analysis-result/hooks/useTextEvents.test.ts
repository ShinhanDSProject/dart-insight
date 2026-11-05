// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import type { TextEventList, TextEventRun } from '@/shared/api/textEvents'
import { useTextEvents } from './useTextEvents'

const api = vi.hoisted(() => ({ getCurrentEventRun: vi.fn(), startEventRun: vi.fn(), getTextEvents: vi.fn(), getTextEvent: vi.fn() }))
vi.mock('@/shared/api/textEvents', () => api)

const run = (status: TextEventRun['status'], notCreatedReason: TextEventRun['notCreatedReason'] = null) => ({ status, notCreatedReason }) as TextEventRun
const list = { items: [{}], unboundChanges: [] } as unknown as TextEventList
const ready = { status: 'ready', list }

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

    await waitFor(() => expect(result.current.view).toEqual(ready))
    expect(api.startEventRun).toHaveBeenCalledTimes(1)
  })

  it('이미 끝난 실행은 시작하지 않고 사건을 받는다', async () => {
    api.getCurrentEventRun.mockResolvedValue(run('COMPLETED'))
    api.getTextEvents.mockResolvedValue(list)

    const { result } = renderHook(() => useTextEvents(1))

    await waitFor(() => expect(result.current.view).toEqual(ready))
    expect(api.startEventRun).not.toHaveBeenCalled()
  })

  it('실패한 실행은 다시 시작하지 않고 사건을 부르지 않는다', async () => {
    api.getCurrentEventRun.mockResolvedValue(run('FAILED'))

    const { result } = renderHook(() => useTextEvents(1))

    await waitFor(() => expect(api.getCurrentEventRun).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve))
    expect(api.startEventRun).not.toHaveBeenCalled()
    expect(api.getTextEvents).not.toHaveBeenCalled()
    expect(result.current.view).toEqual({ status: 'unavailable', retry: 'limited' })
  })

  it('다시 시도하면 실패한 실행을 새로 시작하고, 만드는 중을 거쳐 사건을 받는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.getCurrentEventRun.mockResolvedValueOnce({ ...run('FAILED'), canRetry: true }).mockResolvedValue(run('COMPLETED'))
    api.startEventRun.mockResolvedValue(run('RUNNING'))
    api.getTextEvents.mockResolvedValue(list)
    const { result } = renderHook(() => useTextEvents(1))
    await waitFor(() => expect(result.current.view).toEqual({ status: 'unavailable', retry: 'available' }))

    act(() => result.current.retry())

    expect(result.current.view).toEqual({ status: 'building' })
    await waitFor(() => expect(api.startEventRun).toHaveBeenCalledTimes(1))
    await vi.advanceTimersByTimeAsync(3000)
    await waitFor(() => expect(result.current.view).toEqual(ready))
    expect(api.startEventRun).toHaveBeenCalledTimes(1)
  })

  it('다시 시도가 거절되면 실패 안내로 돌아오고, 다음 조회에서 한도를 알 수 있다', async () => {
    api.getCurrentEventRun.mockResolvedValueOnce({ ...run('FAILED'), canRetry: true }).mockResolvedValue({ ...run('FAILED'), canRetry: false })
    api.startEventRun.mockRejectedValue(new ApiError(429, { code: 'ANALYSIS_EVENTS_RETRY_LIMITED', message: '한도', traceId: 't', errors: [] }))
    const { result } = renderHook(() => useTextEvents(1))
    await waitFor(() => expect(result.current.view).toEqual({ status: 'unavailable', retry: 'available' }))

    act(() => result.current.retry())
    await waitFor(() => expect(result.current.view).toEqual({ status: 'unavailable', retry: 'available' }))
    act(() => result.current.retry())

    await waitFor(() => expect(result.current.view).toEqual({ status: 'unavailable', retry: 'limited' }))
    expect(api.startEventRun).toHaveBeenCalledTimes(1)
  })

  it('상태 조회가 실패했을 때 다시 시도하면 조회만 다시 하고 시작하지 않는다', async () => {
    api.getCurrentEventRun.mockRejectedValueOnce(new ApiError(404, { code: 'ANALYSIS_NOT_FOUND', message: '없음', traceId: 't', errors: [] })).mockResolvedValue(run('COMPLETED'))
    api.getTextEvents.mockResolvedValue(list)
    const { result } = renderHook(() => useTextEvents(1))
    await waitFor(() => expect(result.current.view).toEqual({ status: 'unavailable', retry: 'available' }))

    act(() => result.current.retry())

    await waitFor(() => expect(result.current.view).toEqual(ready))
    expect(api.startEventRun).not.toHaveBeenCalled()
  })

  it('만들지 않은 분석은 사건을 부르지 않는다', async () => {
    api.getCurrentEventRun.mockResolvedValue(run('NOT_CREATED', 'DISABLED'))

    const { result } = renderHook(() => useTextEvents(1))

    await waitFor(() => expect(api.getCurrentEventRun).toHaveBeenCalled())
    await new Promise((resolve) => setTimeout(resolve))
    expect(api.startEventRun).not.toHaveBeenCalled()
    expect(api.getTextEvents).not.toHaveBeenCalled()
    expect(result.current.view).toEqual({ status: 'hidden' })
  })

  it('만드는 중이면 끝날 때까지 다시 묻고, 끝나면 사건을 받는다', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    api.getCurrentEventRun.mockResolvedValueOnce(run('RUNNING')).mockResolvedValue(run('COMPLETED'))
    api.getTextEvents.mockResolvedValue(list)

    const { result } = renderHook(() => useTextEvents(1))

    await waitFor(() => expect(result.current.view).toEqual({ status: 'building' }))
    expect(api.getCurrentEventRun).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(3000)
    await waitFor(() => expect(result.current.view).toEqual(ready))
    expect(api.getCurrentEventRun).toHaveBeenCalledTimes(2)
  })

  it('사건을 받지 못하면 오류를 올리지 않고 만들지 못했다는 상태다', async () => {
    api.getCurrentEventRun.mockResolvedValue(run('COMPLETED'))
    api.getTextEvents.mockRejectedValue(new Error('실패'))

    const { result } = renderHook(() => useTextEvents(1))

    await waitFor(() => expect(result.current.view).toEqual({ status: 'unavailable', retry: 'available' }))
  })
})
