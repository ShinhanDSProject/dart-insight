import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { analysisPath, requestAnalysis } from '../api/analyses'
import { checkComparability, type ComparabilityResult } from '../api/comparability'
import { ErrorState, LoadingState } from '../components/StateView'
import { checkStatusLabel, resultSummary, statementBasisLabel } from './compare/comparabilityLabels'
import { basisLabel, parseBasis } from './company/pairSelection'
import './compare/compare.css'

type CheckState = { kind: 'loading' } | { kind: 'done'; result: ComparabilityResult } | { kind: 'error'; error: unknown }

const errorMessages: Record<string, string> = {
  REPORT_NOT_FOUND: '보고서를 찾지 못했어요. 보고서 선택으로 돌아가 다시 골라 주세요.',
  DART_RATE_LIMITED: 'OpenDART 호출 한도를 넘어 재무제표를 받지 못했어요. 내일 다시 시도해 주세요.',
  DART_REQUEST_FAILED: 'OpenDART에서 재무제표를 받지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  DART_KEY_MISSING: '서버에 OpenDART 키가 설정되지 않았어요. 관리자에게 알려 주세요.',
}

/**
 * W-01 ③ 비교 검증(2.2). 주소: /companies/:corpCode/compare?current=&previous=&basis=
 * 비교할 수 없으면 분석을 시작하지 않고 사유와 다음 행동을 보여 준다.
 * 비교할 수 있으면 '분석 실행'으로 분석을 요청하고 W-02로 간다(2.3).
 */
export function ComparabilityPage() {
  const { corpCode = '' } = useParams()
  const [searchParams] = useSearchParams()
  const currentNo = searchParams.get('current') ?? ''
  const previousNo = searchParams.get('previous') ?? ''
  const basis = parseBasis(searchParams.get('basis'))
  const navigate = useNavigate()
  const [state, setState] = useState<CheckState>({ kind: 'loading' })
  const [retry, setRetry] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<unknown>(null)
  const backTo = `/companies/${encodeURIComponent(corpCode)}?${searchParams.toString()}`
  const hasPair = currentNo !== '' && previousNo !== ''

  useEffect(() => {
    if (!hasPair) return
    let cancelled = false
    setState({ kind: 'loading' })
    checkComparability({ corpCode, currentRceptNo: currentNo, previousRceptNo: previousNo, basis })
      .then((result) => {
        if (!cancelled) setState({ kind: 'done', result })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ kind: 'error', error })
      })
    return () => {
      cancelled = true
    }
  }, [corpCode, currentNo, previousNo, basis, hasPair, retry])

  async function runAnalysis() {
    setSubmitting(true)
    setSubmitError(null)
    try {
      const created = await requestAnalysis({ corpCode, currentRceptNo: currentNo, previousRceptNo: previousNo, basis })
      navigate(analysisPath(created.analysisId, created.status))
    } catch (error) {
      setSubmitError(error)
      setSubmitting(false)
    }
  }

  return (
    <section className="page">
      <nav className="breadcrumb" aria-label="현재 위치">
        <Link to={backTo}>보고서 선택</Link> / 비교 조건 확인
      </nav>
      <h1 className="page__title">비교 대상을 확인하세요</h1>

      {!hasPair && (
        <div className="state state--error" role="alert">
          <p className="state__title">비교할 두 보고서가 정해지지 않았어요.</p>
          <Link to={backTo}>보고서 선택으로 돌아가기</Link>
        </div>
      )}
      {hasPair && state.kind === 'loading' && (
        <LoadingState message="두 보고서의 재무제표를 확인하는 중입니다… 처음 확인하는 보고서는 OpenDART에서 받아 오느라 조금 걸려요." />
      )}
      {hasPair && state.kind === 'error' && (
        <ErrorState error={state.error} onRetry={() => setRetry((n) => n + 1)} messages={errorMessages} />
      )}
      {hasPair && state.kind === 'done' && <CheckResult result={state.result} basis={basisLabel(basis)} />}

      {submitError !== null && (
        <ErrorState
          error={submitError}
          messages={{ ANALYSIS_NOT_COMPARABLE: '비교할 수 없는 보고서 쌍이라 분석을 시작하지 않았어요.' }}
        />
      )}
      <div className="compare-actions">
        <Link to={backTo} className="button button--secondary">
          보고서 다시 선택
        </Link>
        {state.kind === 'done' && state.result.comparable && (
          <button type="button" className="button button--primary" onClick={() => void runAnalysis()} disabled={submitting}>
            {submitting ? '분석을 요청하는 중…' : '분석 실행 →'}
          </button>
        )}
      </div>
    </section>
  )
}

function CheckResult({ result, basis }: { result: ComparabilityResult; basis: string }) {
  return (
    <>
      <p className="page__lead">
        {result.previous.reportName} → {result.current.reportName} · {basis}
      </p>

      <section className="panel" aria-label="비교 조건">
        <table className="check-table">
          <tbody>
            {result.checks.map((check) => (
              <tr key={check.item}>
                <th scope="row">{check.label}</th>
                <td>{check.detail}</td>
                <td className={`check-table__status check-table__status--${check.status.toLowerCase()}`}>
                  {checkStatusLabel(check.status)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {result.comparable ? (
        <div className="notice" role="status">
          {resultSummary(result)}
        </div>
      ) : (
        <div className="not-comparable" role="alert">
          <p className="not-comparable__title">{resultSummary(result)}</p>
          <ul className="not-comparable__reasons">
            {result.reasons.map((reason) => (
              <li key={reason.code}>
                {reason.message} <span className="not-comparable__next">{reason.nextAction}</span>
              </li>
            ))}
          </ul>
          <p className="panel__note">분석은 시작하지 않고, 다른 보고서로 대신하거나 수치를 만들어 내지 않아요.</p>
        </div>
      )}

      {result.comparable && (
        <section className="panel" aria-labelledby="statements-title">
          <h2 id="statements-title" className="panel__title">
            비교하는 재무제표
          </h2>
          <ul className="statement-list">
            {result.statements.map((s) => (
              <li key={s.sjDiv} className={s.comparable ? undefined : 'statement-list__item--off'}>
                <span className="statement-list__name">{s.label}</span>
                <span>{statementBasisLabel(s)}</span>
                {s.note && <span className="statement-list__note">{s.note}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
