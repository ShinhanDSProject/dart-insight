import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { apiBaseUrl, ApiError } from '@/shared/api/client'
import { endpoints } from '@/shared/api/endpoints'
import { useAuth } from '@/shared/auth/authContext'
import './user-login.css'

type SubmitState = { status: 'idle' } | { status: 'loading' }
  | { status: 'error'; message: string; traceId?: string | null }

export function LoginPage() {
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
      const message = apiError?.code === 'AUTH_INVALID_CREDENTIALS'
        ? '이메일 또는 비밀번호를 확인해 주세요.'
        : apiError?.status === 0
          ? '서버에 연결하지 못했습니다. 연결 상태를 확인해 주세요.'
          : '로그인하지 못했습니다. 잠시 뒤 다시 시도해 주세요.'
      setSubmit({ status: 'error', message, traceId: apiError?.traceId })
    }
  }

  const loading = submit.status === 'loading'
  return (
    <section className="login page" aria-labelledby="login-title">
      <div className="login__card">
        <p className="page__step">DART Insight</p>
        <h1 className="page__title" id="login-title">로그인</h1>
        <p className="page__lead">가입한 이메일과 비밀번호를 입력해 주세요.</p>
        {searchParams.get('social') === 'error' && (
          <div className="state state--error login__failure" role="alert">
            <p>소셜 로그인에 실패했습니다. 다시 시도해 주세요.</p>
          </div>
        )}
        <form onSubmit={onSubmit} aria-busy={loading}>
          <div className="login__field">
            <label htmlFor="login-email">이메일</label>
            <input id="login-email" type="email" autoComplete="email" required disabled={loading}
              value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="login__field">
            <label htmlFor="login-password">비밀번호</label>
            <input id="login-password" type="password" autoComplete="current-password" required disabled={loading}
              value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {match(submit).with({ status: 'error' }, (state) => (
            <div className="state state--error login__failure" role="alert">
              <p>{state.message}</p>
              {state.traceId && <p className="state__meta">문의 시 전달할 오류 번호: {state.traceId}</p>}
            </div>
          )).otherwise(() => null)}
          <button type="submit" className="button button--primary login__submit" disabled={loading}>
            {loading ? '로그인 중…' : '로그인'}
          </button>
        </form>
        <div className="login__divider"><span>또는</span></div>
        <div className="login__social" aria-label="소셜 로그인">
          {(['google', 'kakao', 'naver'] as const).map((provider) => (
            <a className={`login__social-button login__social-button--${provider}`}
              href={`${apiBaseUrl}${endpoints.socialLogin(provider)}`} key={provider}>
              {provider === 'google' ? 'Google' : provider === 'kakao' ? '카카오' : '네이버'}로 계속하기
            </a>
          ))}
        </div>
        <p className="login__signup">아직 계정이 없나요? <Link to="/signup">회원가입</Link></p>
      </div>
    </section>
  )
}
