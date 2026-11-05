import { describe, expect, it } from 'vitest'
import { ApiError, NETWORK_ERROR } from '@/shared/api/client'
import { resetFailure } from './passwordReset'

const apiError = (code: string, errors: { field: string; reason: string }[] = []) =>
  new ApiError(400, { code, message: '입력값을 확인해 주세요.', traceId: 't-1', errors })

describe('비밀번호 재설정 실패 나누기(#696)', () => {
  it('링크를 못 쓰면 token으로 나눈다', () => {
    expect(resetFailure(apiError('AUTH_INVALID_RESET_TOKEN'), 'x')).toEqual({ kind: 'token' })
  })

  it('입력 검증 실패는 그 칸의 이유로 나눈다', () => {
    expect(resetFailure(apiError('COMMON_INVALID_INPUT', [{ field: 'password', reason: '특수문자를 1개 이상 포함해 주세요.' }]), 'x'))
      .toEqual({ kind: 'field', field: 'password', reason: '특수문자를 1개 이상 포함해 주세요.' })
  })

  it('칸이 없는 입력 실패·서버 오류는 받은 문구로, 연결 실패는 연결 안내로 나눈다', () => {
    expect(resetFailure(apiError('COMMON_INVALID_INPUT'), '못 했어요')).toEqual({ kind: 'general', message: '못 했어요', traceId: 't-1' })
    expect(resetFailure(new Error('boom'), '못 했어요')).toEqual({ kind: 'general', message: '못 했어요', traceId: null })
    const network = resetFailure(new ApiError(0, { code: NETWORK_ERROR, message: '', traceId: null, errors: [] }), 'x')
    expect(network).toMatchObject({ kind: 'general', message: expect.stringContaining('연결') })
  })
})
