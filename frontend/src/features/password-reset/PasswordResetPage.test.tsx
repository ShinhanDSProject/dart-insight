// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import { axeViolations } from '@/test/axe'
import { PasswordResetPage } from './PasswordResetPage'

const api = vi.hoisted(() => ({ requestPasswordReset: vi.fn(), confirmPasswordReset: vi.fn() }))
vi.mock('./api', () => api)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function renderAt(entry: string) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <PasswordResetPage />
    </MemoryRouter>,
  )
}

const invalidToken = new ApiError(400, { code: 'AUTH_INVALID_RESET_TOKEN', message: '', traceId: null, errors: [] })

describe('비밀번호 찾기 화면(#696)', () => {
  it('이메일을 넣고 요청하면 가입 여부를 밝히지 않는 안내를 보인다', async () => {
    api.requestPasswordReset.mockResolvedValue(undefined)
    const { container } = renderAt('/password-reset')
    expect(await axeViolations(container)).toBe('')

    fireEvent.change(screen.getByLabelText('이메일'), { target: { value: ' member@example.com ' } })
    fireEvent.click(screen.getByRole('button', { name: '재설정 링크 받기' }))

    expect(await screen.findByRole('heading', { name: '메일을 확인해 주세요' })).toBeTruthy()
    expect(screen.getByText(/가입돼 있으면/)).toBeTruthy()
    expect(api.requestPasswordReset).toHaveBeenCalledWith('member@example.com')
  })

  it('이메일이 비면 요청하지 않고 칸 아래에 알린다', () => {
    renderAt('/password-reset')
    fireEvent.click(screen.getByRole('button', { name: '재설정 링크 받기' }))
    expect(screen.getByText('이메일을 입력해 주세요.')).toBeTruthy()
    expect(api.requestPasswordReset).not.toHaveBeenCalled()
  })

  it('링크로 오면 새 비밀번호를 두 번 받고, 다르면 보내지 않는다', () => {
    renderAt('/password-reset?token=abc')
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'Changed!password' } })
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'Different!password' } })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 바꾸기' }))
    expect(screen.getByText('비밀번호가 서로 달라요.')).toBeTruthy()
    expect(api.confirmPasswordReset).not.toHaveBeenCalled()
  })

  it('새 비밀번호를 정하면 토큰과 함께 보내고 로그인으로 안내한다', async () => {
    api.confirmPasswordReset.mockResolvedValue(undefined)
    renderAt('/password-reset?token=abc')
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'Changed!password' } })
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'Changed!password' } })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 바꾸기' }))

    expect(await screen.findByRole('heading', { name: '비밀번호를 바꿨어요' })).toBeTruthy()
    expect(api.confirmPasswordReset).toHaveBeenCalledWith('abc', 'Changed!password')
    expect(screen.getByRole('link', { name: '로그인하기' }).getAttribute('href')).toBe('/login')
  })

  it('링크를 못 쓰면 다시 받게 안내한다', async () => {
    api.confirmPasswordReset.mockRejectedValue(invalidToken)
    renderAt('/password-reset?token=old')
    fireEvent.change(screen.getByLabelText('새 비밀번호'), { target: { value: 'Changed!password' } })
    fireEvent.change(screen.getByLabelText('새 비밀번호 확인'), { target: { value: 'Changed!password' } })
    fireEvent.click(screen.getByRole('button', { name: '비밀번호 바꾸기' }))

    expect(await screen.findByRole('heading', { name: '링크를 쓸 수 없어요' })).toBeTruthy()
    expect(screen.getByRole('link', { name: '재설정 링크 다시 받기' }).getAttribute('href')).toBe('/password-reset')
  })
})
