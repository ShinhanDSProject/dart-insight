import { apiPost } from '@/shared/api/client'
import { endpoints } from '@/shared/api/endpoints'

export interface RegistrationRequest {
  email: string
  password: string
}

export interface RegisteredUser {
  userId: number
  email: string
}

/** 회원가입만 수행한다. 비밀번호 확인과 인증 토큰은 전달/저장하지 않는다. */
export async function registerUser(input: RegistrationRequest): Promise<RegisteredUser> {
  const data = await apiPost<RegisteredUser>(endpoints.users(), {
    email: input.email,
    password: input.password,
  })
  if (!data || !Number.isSafeInteger(data.userId) || data.userId <= 0 || typeof data.email !== 'string') {
    throw new Error('회원가입 결과를 확인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
  }
  return data
}
