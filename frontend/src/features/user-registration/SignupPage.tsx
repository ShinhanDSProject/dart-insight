import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ApiError } from '@/shared/api/client'
import { registerUser } from './api'
import { normalizeEmail, validateRegistration, type RegistrationErrors, type RegistrationFields } from './model/registration'
import './user-registration.css'

const emptyFields: RegistrationFields = { email: '', password: '', passwordConfirm: '' }

export function SignupPage() {
  const [fields, setFields] = useState<RegistrationFields>(emptyFields)
  const [errors, setErrors] = useState<RegistrationErrors>({})
  const [pending, setPending] = useState(false)
  const [failure, setFailure] = useState<{ message: string; traceId?: string | null } | null>(null)
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null)
  const submitting = useRef(false)
  const mounted = useRef(false)
  const form = useRef<HTMLFormElement>(null)
  const success = useRef<HTMLHeadingElement>(null)

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

  function change(field: keyof RegistrationFields, value: string) {
    setFields((previous) => ({ ...previous, [field]: value }))
    // 오류는 다음 제출 때 재검증한다. 타이핑 중 포커스를 다른 필드로 옮기지 않는다.
    setFailure(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || registeredEmail !== null) return
    const problems = validateRegistration(fields)
    setErrors(problems)
    setFailure(null)
    if (Object.keys(problems).length > 0) return

    submitting.current = true
    setPending(true)
    try {
      const result = await registerUser({ email: normalizeEmail(fields.email), password: fields.password })
      if (!mounted.current) return
      setFields(emptyFields)
      setRegisteredEmail(result.email)
    } catch (error: unknown) {
      if (!mounted.current) return
      if (error instanceof ApiError && error.code === 'COMMON_EMAIL_ALREADY_EXISTS') {
        setErrors({ email: '이미 가입된 이메일입니다. 다른 이메일을 입력해 주세요.' })
      } else if (error instanceof ApiError && error.code === 'COMMON_INVALID_INPUT' && error.errors.length > 0) {
        const fieldErrors: RegistrationErrors = {}
        for (const problem of error.errors) {
          if (problem.field === 'email' || problem.field === 'password') {
            fieldErrors[problem.field] = problem.reason
          }
        }
        setErrors(fieldErrors)
        if (Object.keys(fieldErrors).length === 0) setFailure({ message: error.message, traceId: error.traceId })
      } else {
        setFailure({
          message: error instanceof ApiError && error.status === 0
            ? '서버에 연결하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요.'
            : '회원가입을 완료하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
          traceId: error instanceof ApiError ? error.traceId : null,
        })
      }
    } finally {
      submitting.current = false
      if (mounted.current) setPending(false)
    }
  }

  if (registeredEmail !== null) {
    return (
      <section className="signup page" aria-labelledby="signup-success-title">
        <div className="signup__card signup__complete">
          <span className="signup__check" aria-hidden="true">✓</span>
          <h1 className="page__title" id="signup-success-title" ref={success} tabIndex={-1}>회원가입이 완료됐어요</h1>
          <p className="signup__email">{registeredEmail}</p>
          <p className="page__lead">DART Insight에 오신 것을 환영합니다.</p>
          <Link to="/" className="button button--primary">기업 검색으로 이동</Link>
        </div>
      </section>
    )
  }

  return (
    <section className="signup page" aria-labelledby="signup-title">
      <div className="signup__card">
        <p className="page__step">DART Insight</p>
        <h1 className="page__title" id="signup-title">회원가입</h1>
        <p className="page__lead">이메일로 간편하게 가입하세요.</p>
        <form ref={form} onSubmit={submit} noValidate aria-busy={pending}>
          <div className="signup__field">
            <label htmlFor="signup-email">이메일</label>
            <input id="signup-email" name="email" type="email" autoComplete="email" inputMode="email"
              autoCapitalize="none" spellCheck={false} required
              value={fields.email} onChange={(event) => change('email', event.target.value)} disabled={pending}
              placeholder="name@example.com" aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'signup-email-error' : undefined} />
            {errors.email && <p className="signup__error" id="signup-email-error">{errors.email}</p>}
          </div>
          <div className="signup__field">
            <label htmlFor="signup-password">비밀번호</label>
            <input id="signup-password" name="password" type="password" autoComplete="new-password" required
              value={fields.password} onChange={(event) => change('password', event.target.value)} disabled={pending}
              aria-invalid={Boolean(errors.password)}
              aria-describedby={'signup-password-help' + (errors.password ? ' signup-password-error' : '')} />
            <p className="signup__hint" id="signup-password-help">10~128자이며, 영문 대문자와 특수문자를 각각 1개 이상 포함해 주세요.</p>
            {errors.password && <p className="signup__error" id="signup-password-error">{errors.password}</p>}
          </div>
          <div className="signup__field">
            <label htmlFor="signup-confirm">비밀번호 확인</label>
            <input id="signup-confirm" name="passwordConfirm" type="password" autoComplete="new-password" required
              value={fields.passwordConfirm} onChange={(event) => change('passwordConfirm', event.target.value)} disabled={pending}
              aria-invalid={Boolean(errors.passwordConfirm)}
              aria-describedby={errors.passwordConfirm ? 'signup-confirm-error' : undefined} />
            {errors.passwordConfirm && <p className="signup__error" id="signup-confirm-error">{errors.passwordConfirm}</p>}
          </div>
          {failure && (
            <div className="state state--error signup__failure" role="alert">
              <p>{failure.message}</p>
              {failure.traceId && <p className="state__meta">문의 시 전달할 오류 번호: {failure.traceId}</p>}
            </div>
          )}
          <button type="submit" className="button button--primary signup__submit" disabled={pending}>
            {pending ? '가입 처리 중…' : '가입하기'}
          </button>
          <p className="signup__status" role="status">{pending ? '회원가입을 처리하고 있습니다.' : ''}</p>
        </form>
        <Link className="signup__back" to="/">기업 검색으로 돌아가기</Link>
      </div>
    </section>
  )
}
