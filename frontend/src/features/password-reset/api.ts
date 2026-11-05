import { apiPost } from '@/shared/api/client'
import { endpoints } from '@/shared/api/endpoints'

/** 재설정 메일 요청(6.8). 가입 여부와 상관없이 성공(204)한다 */
export async function requestPasswordReset(email: string): Promise<void> {
  await apiPost<null>(endpoints.passwordResets(), { email })
}

/** 메일 링크의 토큰으로 새 비밀번호를 정한다. 로그인 상태는 만들지 않는다 */
export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  await apiPost<null>(endpoints.passwordResetConfirmations(), { token, password })
}
