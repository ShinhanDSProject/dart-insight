// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
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

function Where() {
  const { pathname, search } = useLocation()
  return <p data-testid="where">{pathname + search}</p>
}

/** 로그인 화면을 주소(url)에서 그리고, 로그인 뒤 간 곳을 보인다 */
function renderLoginAt(url: string, overrides: Partial<AuthContextValue> = {}) {
  const value: AuthContextValue = {
    state: { status: 'anonymous' },
    login: vi.fn().mockResolvedValue(undefined),
    logout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
  render(
    <AuthContext.Provider value={value}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
  return value
}

function submit() {
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'Member@Example.com' } })
  fireEvent.change(screen.getByLabelText('비밀번호'), { target: { value: 'Sample!password' } })
  fireEvent.click(screen.getByRole('button', { name: '로그인' }))
}

describe('일반 로그인 화면', () => {
  it('비밀번호 찾기로 가는 링크가 있다(#696)', () => {
    renderLogin()
    expect(screen.getByRole('link', { name: '비밀번호를 잊으셨나요?' }).getAttribute('href')).toBe('/password-reset')
  })

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

describe('로그인 뒤 보던 화면으로 돌아가기', () => {
  afterEach(() => window.sessionStorage.clear())

  it('next에 실린 이 앱의 화면으로 돌아간다', async () => {
    renderLoginAt('/login?next=%2Fanalyses%2F4%3Ftab%3Dfinancial')
    submit()
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/analyses/4?tab=financial'))
  })

  it('이 앱 밖 주소는 무시하고 첫 화면으로 간다', async () => {
    renderLoginAt('/login?next=https%3A%2F%2Fevil.example')
    submit()
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/'))
  })

  it('소셜 로그인은 떠날 때 남긴 화면으로 돌아온다', async () => {
    renderLoginAt('/login?next=%2Fnotes')
    fireEvent.click(screen.getByRole('link', { name: 'Google로 계속하기' }))
    cleanup()
    renderLoginAt('/login?social=success', { state: { status: 'authenticated', userId: 1 } })
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/notes'))
  })
})
