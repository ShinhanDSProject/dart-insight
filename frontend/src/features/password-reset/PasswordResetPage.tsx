import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { match } from 'ts-pattern'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { pageTitle } from '@/shared/lib/pageTitle'
import { Button, ButtonLink, Card, FieldHint, FieldLabel, Input, PageHeader, PasswordInput } from '@/shared/ui'
import { AlertState } from '@/shared/ui/StateView'
import { confirmPasswordReset, requestPasswordReset } from './api'
import { resetFailure, type ResetSubmitState } from './model/passwordReset'
import './password-reset.css'

const IDLE: ResetSubmitState = { status: 'idle' }

/**
 * 비밀번호 찾기(6.8, ADR-0055). 주소에 token이 없으면 이메일을 받아 재설정 메일을 요청하고,
 * 메일 링크(?token=)로 오면 새 비밀번호를 정한다. 가입 여부는 화면에서도 알리지 않는다.
 */
export function PasswordResetPage() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')
  useDocumentTitle(pageTitle([token ? '새 비밀번호 정하기' : '비밀번호 찾기']))
  return (
    <section className="password-reset page" aria-labelledby="password-reset-title">
      <Card className="password-reset__card">{token ? <ConfirmForm token={token} /> : <RequestForm />}</Card>
    </section>
  )
}

function Header({ title, lead }: { title: string; lead: string }) {
  return (
    <PageHeader
      breadcrumb={
        <>
          <Link to="/login">로그인</Link> / 비밀번호 찾기
        </>
      }
      title={title}
      titleId="password-reset-title"
      lead={lead}
    />
  )
}

function FailureNotice({ state }: { state: ResetSubmitState }) {
  return match(state)
    .with({ status: 'error' }, ({ message, traceId }) => (
      <div className="password-reset__failure">
        <AlertState title={message}>{traceId && <p className="state__meta">문의 시 전달할 오류 번호: {traceId}</p>}</AlertState>
      </div>
    ))
    .otherwise(() => null)
}

function RequestForm() {
  const [email, setEmail] = useState('')
  const [emailError, setEmailError] = useState<string | null>(null)
  const [state, setState] = useState<ResetSubmitState>(IDLE)
  const loading = state.status === 'loading'

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    const value = email.trim()
    if (value === '') {
      setEmailError('이메일을 입력해 주세요.')
      return
    }
    setEmailError(null)
    setState({ status: 'loading' })
    try {
      await requestPasswordReset(value)
      setState({ status: 'success' })
    } catch (error: unknown) {
      const failure = resetFailure(error, '메일을 요청하지 못했어요. 잠시 뒤 다시 시도해 주세요.')
      match(failure)
        .with({ kind: 'field' }, ({ reason }) => {
          setEmailError(reason)
          setState(IDLE)
        })
        .with({ kind: 'general' }, ({ message, traceId }) => setState({ status: 'error', message, traceId }))
        .with({ kind: 'token' }, () => setState(IDLE))
        .exhaustive()
    }
  }

  if (state.status === 'success') {
    return (
      <>
        <Header title="메일을 확인해 주세요" lead="입력한 이메일로 가입돼 있으면 비밀번호 재설정 링크를 보냈어요." />
        <p className="password-reset__note" role="status">
          링크는 30분 동안 한 번만 쓸 수 있어요. 메일이 보이지 않으면 스팸함도 확인해 주세요. 소셜 로그인으로 가입했다면 그
          서비스로 로그인해 주세요.
        </p>
        <ButtonLink to="/login" variant="primary" className="password-reset__submit">
          로그인으로 돌아가기
        </ButtonLink>
      </>
    )
  }

  return (
    <>
      <Header title="비밀번호 찾기" lead="가입한 이메일을 입력하면 비밀번호를 다시 정할 수 있는 링크를 보내 드려요." />
      <form onSubmit={onSubmit} aria-busy={loading} noValidate>
        <div className="password-reset__field">
          <FieldLabel htmlFor="reset-email">이메일</FieldLabel>
          <Input id="reset-email" type="email" autoComplete="email" inputMode="email" required disabled={loading}
            value={email} onChange={(event) => setEmail(event.target.value)} invalid={emailError !== null}
            aria-describedby={emailError ? 'reset-email-error' : undefined} />
          {emailError && <p className="password-reset__error" id="reset-email-error">{emailError}</p>}
        </div>
        <FailureNotice state={state} />
        <Button type="submit" variant="primary" className="password-reset__submit" disabled={loading}>
          {loading ? '보내는 중…' : '재설정 링크 받기'}
        </Button>
      </form>
      <Link to="/login" className="password-reset__back">로그인으로 돌아가기</Link>
    </>
  )
}

function ConfirmForm({ token }: { token: string }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})
  const [state, setState] = useState<ResetSubmitState>(IDLE)
  const loading = state.status === 'loading'

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return
    const problems = {
      ...(password === '' ? { password: '새 비밀번호를 입력해 주세요.' } : {}),
      ...(password !== confirm ? { confirm: '비밀번호가 서로 달라요.' } : {}),
    }
    setErrors(problems)
    if (Object.keys(problems).length > 0) return
    setState({ status: 'loading' })
    try {
      await confirmPasswordReset(token, password)
      setPassword('')
      setConfirm('')
      setState({ status: 'success' })
    } catch (error: unknown) {
      const failure = resetFailure(error, '비밀번호를 바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.')
      match(failure)
        .with({ kind: 'token' }, () => setState({ status: 'expired' }))
        .with({ kind: 'field' }, ({ reason }) => {
          setErrors({ password: reason })
          setState(IDLE)
        })
        .with({ kind: 'general' }, ({ message, traceId }) => setState({ status: 'error', message, traceId }))
        .exhaustive()
    }
  }

  return match(state)
    .with({ status: 'success' }, () => (
      <>
        <Header title="비밀번호를 바꿨어요" lead="새 비밀번호로 다시 로그인해 주세요. 다른 기기의 로그인은 모두 끊었어요." />
        <ButtonLink to="/login" variant="primary" className="password-reset__submit">
          로그인하기
        </ButtonLink>
      </>
    ))
    .with({ status: 'expired' }, () => (
      <>
        <Header title="링크를 쓸 수 없어요" lead="링크가 만료됐거나 이미 쓰였어요. 비밀번호 찾기를 다시 해 주세요." />
        <ButtonLink to="/password-reset" variant="primary" className="password-reset__submit">
          재설정 링크 다시 받기
        </ButtonLink>
      </>
    ))
    .otherwise(() => (
      <>
        <Header title="새 비밀번호 정하기" lead="새로 쓸 비밀번호를 입력해 주세요." />
        <form onSubmit={onSubmit} aria-busy={loading} noValidate>
          <div className="password-reset__field">
            <FieldLabel htmlFor="reset-password">새 비밀번호</FieldLabel>
            <PasswordInput id="reset-password" autoComplete="new-password" required disabled={loading}
              value={password} onChange={(event) => setPassword(event.target.value)} invalid={Boolean(errors.password)}
              aria-describedby={'reset-password-help' + (errors.password ? ' reset-password-error' : '')} />
            <FieldHint id="reset-password-help">10~128자이며, 영문 대문자와 특수문자를 각각 1개 이상 포함해 주세요.</FieldHint>
            {errors.password && <p className="password-reset__error" id="reset-password-error">{errors.password}</p>}
          </div>
          <div className="password-reset__field">
            <FieldLabel htmlFor="reset-confirm">새 비밀번호 확인</FieldLabel>
            <PasswordInput id="reset-confirm" autoComplete="new-password" required disabled={loading}
              toggleLabel="새 비밀번호 확인 보기"
              value={confirm} onChange={(event) => setConfirm(event.target.value)} invalid={Boolean(errors.confirm)}
              aria-describedby={errors.confirm ? 'reset-confirm-error' : undefined} />
            {errors.confirm && <p className="password-reset__error" id="reset-confirm-error">{errors.confirm}</p>}
          </div>
          <FailureNotice state={state} />
          <Button type="submit" variant="primary" className="password-reset__submit" disabled={loading}>
            {loading ? '바꾸는 중…' : '비밀번호 바꾸기'}
          </Button>
        </form>
      </>
    ))
}
