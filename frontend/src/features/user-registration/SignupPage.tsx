import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { match, P } from 'ts-pattern'
import { ApiError, NETWORK_ERROR, type FieldError } from '@/shared/api/client'
import { useDocumentTitle } from '@/shared/hooks/useDocumentTitle'
import { pageTitle } from '@/shared/lib/pageTitle'
import { Button, ButtonLink, Card, FieldHint, FieldLabel, Input, PageHeader } from '@/shared/ui'
import { AlertState } from '@/shared/ui/StateView'
import { registerUser } from './api'
import { normalizeEmail, validateRegistration, type RegistrationErrors, type RegistrationFields } from './model/registration'
import './user-registration.css'

const emptyFields: RegistrationFields = { email: '', password: '', passwordConfirm: '' }

interface Failure {
  message: string
  traceId?: string | null
}

/** 가입 요청 상태(ST-1). error는 폼 아래 안내, 입력별 오류는 errors에 따로 둔다 */
type SubmitState =
  | { status: 'idle' }
  | { status: 'loading' }
  | ({ status: 'error' } & Failure)
  | { status: 'success'; email: string }

const IDLE: SubmitState = { status: 'idle' }

/** 가입 실패를 입력 아래 오류(errors)나 폼 아래 안내(failure)로 나눈다. 에러 코드로 고른다(API-3) */
function registrationFailure(error: unknown): { errors?: RegistrationErrors; failure: Failure | null } {
  const apiError = error instanceof ApiError ? error : null
  return match(apiError)
    .with({ code: 'COMMON_EMAIL_ALREADY_EXISTS' }, () => ({
      errors: { email: '이미 가입된 이메일입니다. 다른 이메일을 입력해 주세요.' },
      failure: null,
    }))
    .with({ code: 'COMMON_INVALID_INPUT', errors: P.when((list: FieldError[]) => list.length > 0) }, (invalid) => {
      const fieldErrors: RegistrationErrors = {}
      for (const problem of invalid.errors) {
        if (problem.field === 'email' || problem.field === 'password') {
          fieldErrors[problem.field] = problem.reason
        }
      }
      const failure = Object.keys(fieldErrors).length === 0 ? { message: invalid.message, traceId: invalid.traceId } : null
      return { errors: fieldErrors, failure }
    })
    .with({ code: NETWORK_ERROR }, (network) => ({
      failure: { message: '서버에 연결하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.', traceId: network.traceId },
    }))
    .otherwise(() => ({
      failure: { message: '회원가입을 완료하지 못했습니다. 잠시 뒤 다시 시도해 주세요.', traceId: apiError?.traceId ?? null },
    }))
}

export function SignupPage() {
  useDocumentTitle(pageTitle(['회원가입']))
  const [fields, setFields] = useState<RegistrationFields>(emptyFields)
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [submitState, setSubmitState] = useState<SubmitState>(IDLE)
  const submitting = useRef(false)
  const mounted = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const success = useRef<HTMLHeadingElement>(null)
  const pending = submitState.status === 'loading'
  const registeredEmail = submitState.status === 'success' ? submitState.email : null

  useEffect(() => {
    mounted.current = true
    return () => { mounted.current = false }
  }, [])

  useEffect(() => {
    if (registeredEmail !== null) success.current?.focus()
  }, [registeredEmail])

  useEffect(() => {
    if (!pending && Object.keys(errors).length > 0) {
      form.current?.querySelector<HTMLInputElement>('[aria-invalid="true"]')?.focus()
    }
  }, [errors, pending])

  /** 폼 아래 실패 안내만 지운다(처리 중·완료 상태는 그대로) */
  function clearFailure() {
    setSubmitState((previous) => (previous.status === 'error' ? IDLE : previous))
  }

  function change(field: keyof RegistrationFields, value: string) {
    setFields((previous) => ({ ...previous, [field]: value }))
    // 오류는 다음 제출 때 재검증한다. 타이핑 중 포커스를 다른 필드로 옮기지 않는다.
    clearFailure()
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || registeredEmail !== null) return
    const problems = validateRegistration(fields)
    setErrors(problems)
    clearFailure()
    if (Object.keys(problems).length > 0) return

    submitting.current = true
    setSubmitState({ status: 'loading' })
    try {
      const result = await registerUser({ email: normalizeEmail(fields.email), password: fields.password })
      if (!mounted.current) return
      setFields(emptyFields)
      setSubmitState({ status: 'success', email: result.email })
    } catch (error: unknown) {
      if (!mounted.current) return
      const outcome = registrationFailure(error)
      if (outcome.errors) setErrors(outcome.errors)
      setSubmitState(outcome.failure ? { status: 'error', ...outcome.failure } : IDLE)
    } finally {
      submitting.current = false
    }
  }

  if (registeredEmail !== null) {
    return (
      <section className="signup page" aria-labelledby="signup-success-title">
        <Card className="signup__card signup__complete">
          <span className="signup__check" aria-hidden="true">✓</span>
          <h1 className="page__title" id="signup-success-title" ref={success} tabIndex={-1}>회원가입이 완료됐어요</h1>
          <p className="signup__email">{registeredEmail}</p>
          <p className="page__lead">DART Insight에 오신 것을 환영합니다.</p>
          <ButtonLink to="/" variant="primary">기업 검색으로 이동</ButtonLink>
        </Card>
      </section>
    )
  }

  return (
    <section className="signup page" aria-labelledby="signup-title">
      <Card className="signup__card">
        <PageHeader
          breadcrumb={
            <>
              <Link to="/">기업 검색</Link> / 회원가입
            </>
          }
          title="회원가입"
          titleId="signup-title"
          lead="이메일로 간편하게 가입하세요."
        />
        <form ref={form} onSubmit={submit} noValidate aria-busy={pending}>
          <div className="signup__field">
            <FieldLabel htmlFor="signup-email">이메일</FieldLabel>
            <Input id="signup-email" name="email" type="email" autoComplete="email" inputMode="email"
              autoCapitalize="none" spellCheck={false} required
              value={fields.email} onChange={(event) => change('email', event.target.value)} disabled={pending}
              placeholder="name@example.com" invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'signup-email-error' : undefined} />
            {errors.email && <p className="signup__error" id="signup-email-error">{errors.email}</p>}
          </div>
          <div className="signup__field">
            <FieldLabel htmlFor="signup-password">비밀번호</FieldLabel>
            <Input id="signup-password" name="password" type="password" autoComplete="new-password" required
              value={fields.password} onChange={(event) => change('password', event.target.value)} disabled={pending}
              invalid={Boolean(errors.password)}
              aria-describedby={'signup-password-help' + (errors.password ? ' signup-password-error' : '')} />
            <FieldHint id="signup-password-help">10~128자이며, 영문 대문자와 특수문자를 각각 1개 이상 포함해 주세요.</FieldHint>
            {errors.password && <p className="signup__error" id="signup-password-error">{errors.password}</p>}
          </div>
          <div className="signup__field">
            <FieldLabel htmlFor="signup-confirm">비밀번호 확인</FieldLabel>
            <Input id="signup-confirm" name="passwordConfirm" type="password" autoComplete="new-password" required
              value={fields.passwordConfirm} onChange={(event) => change('passwordConfirm', event.target.value)} disabled={pending}
              invalid={Boolean(errors.passwordConfirm)}
              aria-describedby={errors.passwordConfirm ? 'signup-confirm-error' : undefined} />
            {errors.passwordConfirm && <p className="signup__error" id="signup-confirm-error">{errors.passwordConfirm}</p>}
          </div>
          {match(submitState).with({ status: 'error' }, (failure) => (
            <div className="signup__failure">
              <AlertState title={failure.message}>
                {failure.traceId && <p className="state__meta">문의 시 전달할 오류 번호: {failure.traceId}</p>}
              </AlertState>
            </div>
          )).otherwise(() => null)}
          <Button type="submit" variant="primary" className="signup__submit" disabled={pending}>
            {pending ? '가입 처리 중…' : '가입하기'}
          </Button>
          <p className="signup__status" role="status">{pending ? '회원가입을 처리하고 있습니다.' : ''}</p>
        </form>
        <Link className="signup__back" to="/">기업 검색으로 돌아가기</Link>
      </Card>
    </section>
  )
}
