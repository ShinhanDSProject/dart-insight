import { match, P } from 'ts-pattern'
import { ApiError, NETWORK_ERROR, type FieldError } from '@/shared/api/client'

/** 요청·확정 화면의 상태(ST-1). error는 폼 아래 공통 안내, expired는 확정에서 링크를 못 쓸 때 */
export type ResetSubmitState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success' }
  | { status: 'expired' }
  | { status: 'error'; message: string; traceId: string | null }

/** 실패를 어디에 보일지. field: 입력 아래, token: 링크를 다시 받게 안내, general: 폼 아래 */
export type ResetFailure =
  | { kind: 'field'; field: 'email' | 'password'; reason: string }
  | { kind: 'token' }
  | { kind: 'general'; message: string; traceId: string | null }

function fieldProblem(errors: FieldError[]): FieldError | undefined {
  return errors.find((e) => e.field === 'email' || e.field === 'password')
}

/** API 실패를 에러 코드로 나눈다(API-3) */
export function resetFailure(error: unknown, fallback: string): ResetFailure {
  const apiError = error instanceof ApiError ? error : null
  return match(apiError)
    .with({ code: 'AUTH_INVALID_RESET_TOKEN' }, (): ResetFailure => ({ kind: 'token' }))
    .with({ code: 'COMMON_INVALID_INPUT', errors: P.when((list: FieldError[]) => fieldProblem(list) !== undefined) }, (invalid): ResetFailure => {
      const problem = fieldProblem(invalid.errors)!
      return { kind: 'field', field: problem.field as 'email' | 'password', reason: problem.reason }
    })
    .with({ code: NETWORK_ERROR }, (network): ResetFailure => ({
      kind: 'general',
      message: '서버에 연결하지 못했어요. 연결 상태를 확인하고 다시 시도해 주세요.',
      traceId: network.traceId,
    }))
    .otherwise((): ResetFailure => ({ kind: 'general', message: fallback, traceId: apiError?.traceId ?? null }))
}
