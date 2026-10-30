import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { apiBaseUrl, ApiError, NETWORK_ERROR } from '@/shared/api/client'
import { endpoints } from '@/shared/api/endpoints'
import { useAuth } from '@/shared/auth/authContext'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { pageTitle } from '@/shared/lib/pageTitle'
import { Button, Card, FieldLabel, Input, PageHeader } from '@/shared/ui'
import { AlertState } from '@/shared/ui/StateView'
import './user-login.css'

type SubmitState = { status: 'idle' } | { status: 'loading' }
  | { status: 'error'; message: string; traceId?: string | null }

type SocialProvider = 'google' | 'kakao' | 'naver'

const SOCIAL_PROVIDERS: SocialProvider[] = ['google', 'kakao', 'naver']
const SOCIAL_LABELS: Record<SocialProvider, string> = { google: 'Google', kakao: '카카오', naver: '네이버' }

/** 로그인 실패 안내. 에러 코드로 고른다(API-3) */
function loginFailureMessage(error: ApiError | null): string {
  return match(error?.code)
    .with('AUTH_INVALID_CREDENTIALS', () => '이메일 또는 비밀번호를 확인해 주세요.')
    .with(NETWORK_ERROR, () => '서버에 연결하지 못했습니다. 연결 상태를 확인해 주세요.')
    .otherwise(() => '로그인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.')
}

export function LoginPage() {
  useDocumentTitle(pageTitle(['로그인']))
  const auth = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submit, setSubmit] = useState<SubmitState>({ status: 'idle' })

  useEffect(() => {
    if (searchParams.get('social') === 'success' && auth.state.status === 'authenticated') {
      void navigate('/', { replace: true })
    }
  }, [auth.state.status, navigate, searchParams])

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submit.status === 'loading') return
    setSubmit({ status: 'loading' })
    try {
      await auth.login(email, password)
      setPassword('')
      await navigate('/')
    } catch (error: unknown) {
      const apiError = error instanceof ApiError ? error : null
      setSubmit({ status: 'error', message: loginFailureMessage(apiError), traceId: apiError?.traceId })
    }
  }

  const loading = submit.status === 'loading'
  return (
    <section className="login page" aria-labelledby="login-title">
      <Card className="login__card">
        <PageHeader
          breadcrumb={
            <>
              <Link to="/">기업 검색</Link> / 로그인
            </>
          }
          title="로그인"
          titleId="login-title"
          lead="가입한 이메일과 비밀번호를 입력해 주세요."
        />
        {searchParams.get('social') === 'error' && (
          <div className="login__failure">
            <AlertState title="소셜 로그인에 실패했습니다. 다시 시도해 주세요." />
          </div>
        )}
        <form onSubmit={onSubmit} aria-busy={loading}>
          <div className="login__field">
            <FieldLabel htmlFor="login-email">이메일</FieldLabel>
            <Input id="login-email" type="email" autoComplete="email" required disabled={loading}
              value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="login__field">
            <FieldLabel htmlFor="login-password">비밀번호</FieldLabel>
            <Input id="login-password" type="password" autoComplete="current-password" required disabled={loading}
              value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {match(submit).with({ status: 'error' }, (state) => (
            <div className="login__failure">
              <AlertState title={state.message}>
                {state.traceId && <p className="state__meta">문의 시 전달할 오류 번호: {state.traceId}</p>}
              </AlertState>
            </div>
          )).otherwise(() => null)}
          <Button type="submit" variant="primary" className="login__submit" disabled={loading}>
            {loading ? '로그인 중…' : '로그인'}
          </Button>
        </form>
        <div className="login__divider"><span>또는</span></div>
        <div className="login__social" aria-label="소셜 로그인">
          {SOCIAL_PROVIDERS.map((provider) => (
            <a className={`login__social-button login__social-button--${provider}`}
              href={`${apiBaseUrl}${endpoints.socialLogin(provider)}`} key={provider}>
              {SOCIAL_LABELS[provider]}로 계속하기
            </a>
          ))}
        </div>
        <p className="login__signup">아직 계정이 없나요? <Link to="/signup">회원가입</Link></p>
      </Card>
    </section>
  )
}
