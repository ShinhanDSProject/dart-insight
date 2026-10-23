import type { ReactNode } from 'react'
import { ApiError, NETWORK_ERROR } from '@/shared/api/client'
import { Button } from './Button'

/** 로딩·오류·빈 결과 상태. 상태를 숨기지 않고 항상 한 가지를 보여 준다. */

export function LoadingState({ message = '불러오는 중입니다…' }: { message?: string }) {
  return (
    <div className="state state--loading" role="status" aria-live="polite">
      <span className="state__spinner" aria-hidden="true" />
      {message}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state state--empty">
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

export function ErrorState({ error, onRetry, messages }: ErrorStateProps) {
  const apiError = error instanceof ApiError ? error : null
  const code = apiError?.code ?? 'COMMON_INTERNAL_ERROR'
  const message = messages?.[code] ?? apiError?.message ?? '알 수 없는 오류가 발생했습니다.'

  return (
    <AlertState title={message}>
      {code === NETWORK_ERROR && <p>계속되면 관리자에게 알려 주세요.</p>}
      {apiError?.traceId && <p className="state__meta">추적 ID: <code>{apiError.traceId}</code></p>}
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </AlertState>
  )
}

/** 화면을 이어 갈 수 없는 오류(요청 실패 등). ErrorState처럼 API 에러가 없을 때 제목과 다음 행동을 직접 넘긴다. */
export function AlertState({ title, children }: { title: ReactNode; children?: ReactNode }) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">{title}</p>
      {children}
    </div>
  )
}
