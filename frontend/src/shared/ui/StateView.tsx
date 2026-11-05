import { useContext, type ReactNode } from 'react'
import { ApiError, NETWORK_ERROR } from '@/shared/api/client'
import { AuthContext } from '@/shared/auth/authContext'
import { useLoginHref } from '@/shared/hooks/useLoginHref'
import { Button, ButtonLink } from './Button'
import { Mascot } from './Mascot'

/** 로딩·오류·빈 결과 상태. 상태를 숨기지 않고 항상 한 가지를 보여 준다. */

export function LoadingState({ message = '불러오는 중입니다…' }: { message?: string }) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <span className="state__spinner" aria-hidden="true" />
      {message}
    </div>
  )
}

interface EmptyStateProps {
  title: string
  children?: ReactNode
  /** '찾지 못함'처럼 사용자가 기대한 결과가 없을 때만 '설명 없음' 캐릭터를 둔다(#706). 단순히 비어 있는 목록에는 두지 않는다 */
  mascot?: boolean
}

export function EmptyState({ title, children, mascot = false }: EmptyStateProps) {
  return (
    <div className="state state--empty">
      {mascot && <Mascot mood="none" size="md" className="state__mascot" />}
      <p className="state__title">{title}</p>
      {children}
    </div>
  )
}

interface ErrorStateProps {
  error: unknown
  onRetry?: () => void
  /** 에러 코드별로 다른 안내가 필요할 때 */
  messages?: Record<string, string>
}

/** 하루 AI 질문 한도를 넘음(429, ADR-0054) */
export const AI_QUOTA_EXCEEDED = 'AI_QUOTA_EXCEEDED'

export function ErrorState({ error, onRetry, messages }: ErrorStateProps) {
  const apiError = error instanceof ApiError ? error : null
  const code = apiError?.code ?? 'COMMON_INTERNAL_ERROR'
  const message = messages?.[code] ?? apiError?.message ?? '알 수 없는 오류가 발생했습니다.'
  // 하루 AI 한도(ADR-0054)는 다시 눌러도 내일 0시까지 같은 답이라 '다시 시도' 대신 로그인(비로그인일 때)을 권한다.
  // AuthProvider 밖(테스트·단독 화면)에서는 로그인 상태를 모르므로 로그인 링크를 보이지 않는다
  const auth = useContext(AuthContext)
  const quotaExceeded = code === AI_QUOTA_EXCEEDED
  const suggestLogin = quotaExceeded && auth?.state.status === 'anonymous'

  return (
    <AlertState title={message}>
      {code === NETWORK_ERROR && <p>계속되면 관리자에게 알려 주세요.</p>}
      {apiError?.traceId && <p className="state__meta">추적 ID: <code>{apiError.traceId}</code></p>}
      {suggestLogin && <LoginLink />}
      {onRetry && !quotaExceeded && (
        <Button variant="secondary" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </AlertState>
  )
}

/** 화면을 이어 갈 수 없는 오류(요청 실패 등). ErrorState처럼 API 에러가 없을 때 제목과 다음 행동을 직접 넘긴다. */
export function AlertState({ title, children, mascot = false }: { title: ReactNode; children?: ReactNode; mascot?: boolean }) {
  return (
    <div className="state state--error" role="alert">
      {mascot && <Mascot mood="none" size="md" className="state__mascot" />}
      <p className="state__title">{title}</p>
      {children}
    </div>
  )
}

/** 로그인한 뒤 지금 화면으로 돌아오는 링크. 보일 때만 주소를 읽어, 라우터 밖에서 그리는 ErrorState는 영향을 받지 않는다 */
function LoginLink() {
  const loginHref = useLoginHref()
  return (
    <ButtonLink variant="secondary" to={loginHref}>
      로그인하기
    </ButtonLink>
  )
}
