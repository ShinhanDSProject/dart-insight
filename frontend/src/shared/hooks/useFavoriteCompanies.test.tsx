// @vitest-environment jsdom
import { act, cleanup, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FavoriteCompany } from '@/shared/api/favoriteCompanies'
import { AuthContext, type AuthContextValue, type AuthState } from '@/shared/auth/authContext'
import { syncFavoriteCompanies, useFavoriteCompanies } from './useFavoriteCompanies'

const api = vi.hoisted(() => ({
  getFavoriteCompanies: vi.fn(),
  addFavoriteCompany: vi.fn(),
  removeFavoriteCompany: vi.fn(),
}))
vi.mock('@/shared/api/favoriteCompanies', () => api)

const samsung = { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true }
const saved: FavoriteCompany = { ...samsung, addedAt: '2026-10-26T10:00:00' }
const other: FavoriteCompany = {
  corpCode: '00164779', corpName: 'SK하이닉스', stockCode: '000660', listed: true, addedAt: '2026-10-26T09:00:00',
}

function renderFavorites(initial: AuthState) {
  let state = initial
  const wrapper = ({ children }: { children: ReactNode }) => {
    const value: AuthContextValue = { state, login: vi.fn(), logout: vi.fn() }
    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  }
  const view = renderHook(() => useFavoriteCompanies(), { wrapper })
  return {
    ...view,
    setAuth(next: AuthState) {
      state = next
      view.rerender()
    },
  }
}

/** 부른 쪽이 정할 때 끝나는 Promise */
function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

beforeEach(() => {
  api.getFavoriteCompanies.mockResolvedValue({ items: [other] })
  api.addFavoriteCompany.mockResolvedValue(saved)
  api.removeFavoriteCompany.mockResolvedValue(undefined)
})

afterEach(() => {
  cleanup()
  syncFavoriteCompanies(null)
  vi.clearAllMocks()
})

describe('useFavoriteCompanies(#36)', () => {
  it('로그인하지 않았으면 서버를 부르지 않고 빈 목록이며 바꿀 수 없다', async () => {
    const { result } = renderFavorites({ status: 'anonymous' })
    expect(result.current.status).toBe('anonymous')
    expect(result.current.items).toEqual([])
    await act(() => result.current.toggle(samsung))
    expect(api.getFavoriteCompanies).not.toHaveBeenCalled()
    expect(api.addFavoriteCompany).not.toHaveBeenCalled()
  })

  it('로그인했으면 그 회원의 목록을 한 번 받는다', async () => {
    const { result } = renderFavorites({ status: 'authenticated', userId: 1 })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.items).toEqual([other])
    expect(api.getFavoriteCompanies).toHaveBeenCalledTimes(1)
  })

  it('목록을 받는 중에는 바꾸지 않아 늦게 온 목록이 방금 바꾼 것을 덮지 않는다', async () => {
    const pending = deferred<{ items: FavoriteCompany[] }>()
    api.getFavoriteCompanies.mockReturnValue(pending.promise)
    const { result } = renderFavorites({ status: 'authenticated', userId: 1 })
    expect(result.current.status).toBe('loading')
    await act(() => result.current.toggle(samsung))
    expect(api.addFavoriteCompany).not.toHaveBeenCalled()
    await act(async () => pending.resolve({ items: [other] }))
    expect(result.current.items).toEqual([other])
  })

  it('로그아웃한 뒤에 도착한 앞선 목록은 버린다', async () => {
    const pending = deferred<{ items: FavoriteCompany[] }>()
    api.getFavoriteCompanies.mockReturnValueOnce(pending.promise)
    const view = renderFavorites({ status: 'authenticated', userId: 1 })
    view.setAuth({ status: 'anonymous' })
    view.setAuth({ status: 'authenticated', userId: 1 })
    await waitFor(() => expect(view.result.current.status).toBe('ready'))
    await act(async () => pending.resolve({ items: [saved] }))
    expect(view.result.current.items).toEqual([other])
  })

  it('관심 기업이 아니면 서버에 추가하고 맨 앞에 보인다', async () => {
    const { result } = renderFavorites({ status: 'authenticated', userId: 1 })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(() => result.current.toggle(samsung))
    expect(api.addFavoriteCompany).toHaveBeenCalledWith(samsung.corpCode)
    expect(result.current.items.map((item) => item.corpCode)).toEqual([samsung.corpCode, other.corpCode])
    expect(result.current.isFavorite(samsung.corpCode)).toBe(true)
  })

  it('이미 관심 기업이면 서버에서 빼고 목록에서도 사라진다', async () => {
    const { result } = renderFavorites({ status: 'authenticated', userId: 1 })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await act(() => result.current.toggle(other))
    expect(api.removeFavoriteCompany).toHaveBeenCalledWith(other.corpCode)
    expect(result.current.items).toEqual([])
  })

  it('바꾸기가 실패하면 목록을 그대로 두고 실패를 부른 쪽에 알린다', async () => {
    api.addFavoriteCompany.mockRejectedValue(new Error('network'))
    const { result } = renderFavorites({ status: 'authenticated', userId: 1 })
    await waitFor(() => expect(result.current.status).toBe('ready'))
    await expect(act(() => result.current.toggle(samsung))).rejects.toThrow('network')
    expect(result.current.items).toEqual([other])
  })

  it('목록 받기가 실패하면 error가 되고 다시 받을 수 있다', async () => {
    api.getFavoriteCompanies.mockRejectedValueOnce(new Error('network'))
    const { result } = renderFavorites({ status: 'authenticated', userId: 1 })
    await waitFor(() => expect(result.current.status).toBe('error'))
    act(() => result.current.reload())
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.items).toEqual([other])
  })
})
