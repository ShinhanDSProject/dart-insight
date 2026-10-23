// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SignupPage } from './SignupPage'

const password = 'Sample!password'
const successResponse = () => new Response(JSON.stringify({ userId: 1, email: 'member@example.com' }), { status: 201 })

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function openForm() {
  return render(<MemoryRouter><SignupPage /></MemoryRouter>)
}

function fillForm(confirm = password) {
  fireEvent.change(screen.getByLabelText('이메일'), { target: { value: 'Member@Example.COM' } })
  fireEvent.change(screen.getByLabelText('비밀번호', { exact: true }), { target: { value: password } })
  fireEvent.change(screen.getByLabelText('비밀번호 확인'), { target: { value: confirm } })
}

describe('회원가입 화면', () => {
  it('비밀번호 불일치는 요청 없이 안내하고 해당 입력으로 초점을 옮긴다', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    openForm()
    fillForm('Different!password')
    fireEvent.click(screen.getByRole('button', { name: '가입하기' }))
    expect(screen.getByText('비밀번호가 일치하지 않습니다.')).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByLabelText('비밀번호 확인'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('처리 중 중복 제출을 막고 성공 후 비밀번호 입력을 제거한다', async () => {
    let resolve!: (response: Response) => void
    const fetchMock = vi.fn().mockReturnValue(new Promise<Response>((done) => { resolve = done }))
    vi.stubGlobal('fetch', fetchMock)
    const store = vi.spyOn(Storage.prototype, 'setItem')
    const { container } = openForm()
    fillForm()
    const form = container.querySelector('form')!
    fireEvent.submit(form)
    fireEvent.submit(form)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect((screen.getByRole('button', { name: '가입 처리 중…' }) as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('이메일') as HTMLInputElement).disabled).toBe(true)
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ email: 'member@example.com', password })

    await act(async () => { resolve(successResponse()) })
    const heading = screen.getByRole('heading', { name: '회원가입이 완료됐어요' })
    expect(document.activeElement).toBe(heading)
    expect(screen.queryByLabelText('비밀번호', { exact: true })).toBeNull()
    expect(screen.getByRole('link', { name: '기업 검색으로 이동' }).getAttribute('href')).toBe('/')
    expect(store).not.toHaveBeenCalled()
    expect(container.textContent).not.toContain(password)
  })

  it('중복 이메일을 입력 아래 표시하고 수정할 수 있게 한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'COMMON_EMAIL_ALREADY_EXISTS', message: '이미 가입된 이메일입니다.', errors: [], traceId: 'test',
    }), { status: 409 })))
    openForm()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: '가입하기' }))
    expect(await screen.findByText('이미 가입된 이메일입니다. 다른 이메일을 입력해 주세요.')).toBeTruthy()
    await waitFor(() => expect((screen.getByLabelText('이메일') as HTMLInputElement).disabled).toBe(false))
    expect(document.activeElement).toBe(screen.getByLabelText('이메일'))
  })

  it('서버 필드 검증 메시지를 해당 입력에 연결한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'COMMON_INVALID_INPUT', message: '입력값을 확인해 주세요.', traceId: 'test',
      errors: [{ field: 'password', reason: '비밀번호 규칙을 확인해 주세요.' }],
    }), { status: 400 })))
    openForm()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: '가입하기' }))
    const error = await screen.findByText('비밀번호 규칙을 확인해 주세요.')
    expect(screen.getByLabelText('비밀번호', { exact: true }).getAttribute('aria-describedby')).toContain(error.id)
  })

  it('연결 실패는 완료로 처리하지 않고 직접 재시도할 수 있다', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('network')).mockResolvedValueOnce(successResponse())
    vi.stubGlobal('fetch', fetchMock)
    openForm()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: '가입하기' }))
    expect((await screen.findByRole('alert')).textContent).toContain('서버에 연결하지 못했습니다.')
    expect(screen.queryByRole('heading', { name: '회원가입이 완료됐어요' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '가입하기' }))
    expect(await screen.findByRole('heading', { name: '회원가입이 완료됐어요' })).toBeTruthy()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('서버 오류는 내부 메시지 대신 안내와 추적 ID를 보여준다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'COMMON_INTERNAL_ERROR', message: 'internal detail must not show', traceId: 'signup-trace', errors: [],
    }), { status: 500 })))
    openForm()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: '가입하기' }))
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('회원가입을 완료하지 못했습니다.')
    expect(alert.textContent).toContain('signup-trace')
    expect(alert.textContent).not.toContain('internal detail')
  })

  it('페이지를 떠난 후 도착한 응답으로 완료 화면을 만들지 않는다', async () => {
    let resolve!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise<Response>((done) => { resolve = done })))
    const { unmount } = openForm()
    fillForm()
    fireEvent.click(screen.getByRole('button', { name: '가입하기' }))
    unmount()
    await act(async () => { resolve(successResponse()) })
    expect(screen.queryByRole('heading', { name: '회원가입이 완료됐어요' })).toBeNull()
  })
})
