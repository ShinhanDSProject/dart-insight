import { useMemo } from 'react'
import { match } from 'ts-pattern'
import { getCurrentMember } from '@/shared/api/community'
import { useAuth } from '@/shared/auth/authContext'
import { useAsync, type Loader } from './useAsync'

/** 관리자 콘솔에 들어갈 수 있는지(FS-72). 화면 판단일 뿐이고 권한은 서버가 API마다 다시 확인한다(ADR-0040) */
export type AdminAccess =
  | { status: 'loading' }
  | { status: 'anonymous' }
  | { status: 'member' }
  | { status: 'admin' }
  | { status: 'error'; error: unknown }

/**
 * 로그인한 회원이면 GET /api/sessions/current의 admin으로 정한다. 로그인 전이면 부르지 않고 anonymous다.
 * 회원이 바뀌면(다른 계정으로 로그인) 다시 묻고, 이전 요청은 취소한다(ST-5).
 */
export function useAdminAccess(): { access: AdminAccess; reload: () => void } {
  const auth = useAuth()
  const userId = auth.state.status === 'authenticated' ? auth.state.userId : null
  // 회원이 바뀌면 새 함수가 되어 다시 부른다
  const load = useMemo(
    (): Loader<boolean> | null =>
      userId === null ? null : (signal) => getCurrentMember({ signal }).then((member) => member.admin),
    [userId],
  )
  const member = useAsync(load)
  const access = match(auth.state.status)
    .with('loading', (): AdminAccess => ({ status: 'loading' }))
    .with('anonymous', (): AdminAccess => ({ status: 'anonymous' }))
    .with('authenticated', () =>
      match(member.state)
        .with({ status: 'idle' }, { status: 'loading' }, (): AdminAccess => ({ status: 'loading' }))
        .with({ status: 'success' }, ({ data }): AdminAccess => (data ? { status: 'admin' } : { status: 'member' }))
        .with({ status: 'error' }, ({ error }): AdminAccess => ({ status: 'error', error }))
        .exhaustive(),
    )
    .exhaustive()
  return { access, reload: member.reload }
}
