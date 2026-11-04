// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AuthContext, type AuthState } from '@/shared/auth/authContext'
import { useAdminAccess } from './useAdminAccess'

const member = vi.hoisted(() => vi.fn())
vi.mock('@/shared/api/community', () => ({ getCurrentMember: member }))

afterEach(() => member.mockReset())

function wrap(state: AuthState) {
  return ({ children }: { children: ReactNode }) => (
    <AuthContext.Provider value={{ state, login: vi.fn(), logout: vi.fn() }}>{children}</AuthContext.Provider>
  )
}

describe('useAdminAccess(FS-72)', () => {
  it('로그인 확인 중이면 loading, 로그인 전이면 anonymous이고 서버를 부르지 않는다', () => {
    expect(renderHook(() => useAdminAccess(), { wrapper: wrap({ status: 'loading' }) }).result.current.access).toEqual({ status: 'loading' })
    expect(renderHook(() => useAdminAccess(), { wrapper: wrap({ status: 'anonymous' }) }).result.current.access).toEqual({ status: 'anonymous' })
    expect(member).not.toHaveBeenCalled()
  })

  it('로그인했으면 현재 회원의 admin으로 관리자·회원을 나눈다', async () => {
    member.mockResolvedValueOnce({ userId: 1, nickname: null, admin: true })
    const admin = renderHook(() => useAdminAccess(), { wrapper: wrap({ status: 'authenticated', userId: 1 }) })
    await waitFor(() => expect(admin.result.current.access).toEqual({ status: 'admin' }))
    member.mockResolvedValueOnce({ userId: 2, nickname: '배당러', admin: false })
    const normal = renderHook(() => useAdminAccess(), { wrapper: wrap({ status: 'authenticated', userId: 2 }) })
    await waitFor(() => expect(normal.result.current.access).toEqual({ status: 'member' }))
  })

  it('회원 정보를 받지 못하면 error다', async () => {
    const error = new Error('network')
    member.mockRejectedValueOnce(error)
    const { result } = renderHook(() => useAdminAccess(), { wrapper: wrap({ status: 'authenticated', userId: 3 }) })
    await waitFor(() => expect(result.current.access).toEqual({ status: 'error', error }))
  })
})
