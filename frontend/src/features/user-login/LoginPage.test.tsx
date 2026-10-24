// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import { AuthContext, type AuthContextValue } from '@/shared/auth/authContext'
import { LoginPage } from './LoginPage'

afterEach(() => cleanup())

function renderLogin(overrides: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    state: { status: 'anonymous' },
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(<AuthContext.Provider value={value}><MemoryRouter><LoginPage /></MemoryRouter></AuthContext.Provider>)
  return value
}

function submit() {
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'Member@Example.com' } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Sample!password' } })
  fireEvent.click(screen.getByRole('button', { name: '로그인' }))
}

describe('일반 로그인 화면', () => {
  it('Google, 카카오, 네이버 로그인 경로를 제공한다', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: 'Google로 계속하기' }).getAttribute('href'))
      .toBe('/oauth2/authorization/google')
    expect(screen.getByRole('link', { name: '카카오로 계속하기' }).getAttribute('href'))
      .toBe('/oauth2/authorization/kakao')
    expect(screen.getByRole('link', { name: '네이버로 계속하기' }).getAttribute('href'))
      .toBe('/oauth2/authorization/naver')
  })

  it('입력한 이메일과 비밀번호로 로그인한다', () => {
    const auth = renderLogin()
    submit()
    expect(auth.login).toHaveBeenCalledWith('Member@Example.com', 'Sample!password')
  })

  it('인증 실패는 계정 존재 여부를 구분하지 않는 안내를 보여 준다', async () => {
    renderLogin({ login: vi.fn().mockRejectedValue(new ApiError(401, {
      code: 'AUTH_INVALID_CREDENTIALS', message: '인증 실패', traceId: 'login-test', errors: [],
    })) })
    submit()
    expect(await screen.findByText('이메일 또는 비밀번호를 확인해 주세요.')).toBeTruthy()
    expect(screen.getByText(/login-test/)).toBeTruthy()
  })
})
