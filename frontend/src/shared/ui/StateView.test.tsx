// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import { AuthContext, type AuthState } from '@/shared/auth/authContext'
import { AI_QUOTA_EXCEEDED, ErrorState } from './StateView'

afterEach(cleanup)

const quota = new ApiError(429, {
  code: AI_QUOTA_EXCEEDED,
  message: '로그인하지 않고 쓸 수 있는 오늘 AI 질문 20회를 다 썼어요. 로그인하면 더 쓸 수 있어요.',
  traceId: 'trace-quota',
  errors: [],
})

function drawWith(state: AuthState | null, error: unknown) {
  const onRetry = vi.fn()
  const tree = <ErrorState error={error} onRetry={onRetry} />
  render(
    <MemoryRouter>
      {state ? <AuthContext.Provider value={{ state, login: vi.fn(), logout: vi.fn() }}>{tree}</AuthContext.Provider> : tree}
    </MemoryRouter>,
  )
  return onRetry
}

describe('ErrorState', () => {
  it('하루 AI 한도(429)는 서버 안내를 보이고, 내일까지 소용없는 다시 시도 대신 비로그인이면 로그인을 권한다', () => {
    drawWith({ status: 'anonymous' }, quota)
    expect(screen.getByText(/로그인하면 더 쓸 수 있어요/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    expect(screen.getByRole('link', { name: '로그인하기' }).getAttribute('href')).toBe('/login')
  })

  it('회원이 한도를 넘었거나 로그인 상태를 모르면 로그인 링크도 다시 시도도 없다', () => {
    drawWith({ status: 'authenticated', userId: 1 }, quota)
    expect(screen.queryByRole('link', { name: '로그인하기' })).toBeNull()
    expect(screen.queryByRole('button', { name: '다시 시도' })).toBeNull()
    cleanup()
    drawWith(null, quota)
    expect(screen.queryByRole('link', { name: '로그인하기' })).toBeNull()
  })

  it('다른 오류는 그대로 다시 시도를 보인다', () => {
    const unavailable = new ApiError(503, { code: 'AI_SERVER_UNAVAILABLE', message: 'AI 서버가 응답하지 않습니다.', traceId: 't', errors: [] })
    drawWith({ status: 'anonymous' }, unavailable)
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
    expect(screen.queryByRole('link', { name: '로그인하기' })).toBeNull()
  })
})
