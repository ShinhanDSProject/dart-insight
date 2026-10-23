import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/shared/api/client'
import { registerUser } from './api'

afterEach(() => vi.unstubAllGlobals())

describe('회원가입 API', () => {
  it('가입 정보만 보내고 회원 응답을 받는다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ userId: 1, email: 'member@example.com' }), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)
    const input = { email: 'member@example.com', password: 'Sample!password', passwordConfirm: 'must not be sent' }
    await expect(registerUser(input)).resolves.toEqual({ userId: 1, email: 'member@example.com' })
    const [url, request] = fetchMock.mock.calls[0]
    expect(url).toMatch(/\/api\/users$/)
    expect(request.method).toBe('POST')
    expect(JSON.parse(request.body)).toEqual({ email: input.email, password: input.password })
    expect(request.headers).not.toHaveProperty('Authorization')
  })

  it('중복 이메일 오류와 추적 ID를 유지한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      code: 'COMMON_EMAIL_ALREADY_EXISTS', message: '이미 가입된 이메일입니다.', traceId: 'registration-test', errors: [],
    }), { status: 409 })))
    await expect(registerUser({ email: 'member@example.com', password: 'Sample!password' }))
      .rejects.toMatchObject({ status: 409, code: 'COMMON_EMAIL_ALREADY_EXISTS', traceId: 'registration-test' })
  })

  it('응답 유실 시 자동 재전송하지 않는다', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network'))
    vi.stubGlobal('fetch', fetchMock)
    await expect(registerUser({ email: 'member@example.com', password: 'Sample!password' })).rejects.toBeInstanceOf(ApiError)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it.each([{}, { userId: 0, email: 'member@example.com' }, { userId: 1 }])('잘못된 성공 응답은 완료로 처리하지 않는다', async (body) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status: 201 })))
    await expect(registerUser({ email: 'member@example.com', password: 'Sample!password' })).rejects.toThrow()
  })
})
