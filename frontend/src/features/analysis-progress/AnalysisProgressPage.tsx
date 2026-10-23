import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { analysisPath, getAnalysis, requestAnalysis, type Analysis } from '@/shared/api/analyses'
import { ApiError } from '@/shared/api/client'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { periodLabel } from '@/shared/lib/reportLabels'
import { MAX_POLL_FAILURES, nextPollDelay, statusLabel, stepSummary } from './model/progress'
import './analysis-progress.css'

type PollState =
  | { kind: 'loading' }
  | { kind: 'ok'; analysis: Analysis; failures: number }
  | { kind: 'stopped'; error: unknown; analysis: Analysis | null }

/**
 * W-02 분석 진행(2.3). 1초마다 상태를 묻고, 완료되면 결과 화면(W-03)으로 간다.
 * 실패하면 사유와 '다시 요청'을 보여 준다. 결과가 저장되기 전에는 완료로 보이지 않는다(서버가 보장).
 */
export function AnalysisProgressPage() {
  const { analysisId = '' } = useParams()
  const navigate = useNavigate()
  const [state, setState] = useState<PollState>({ kind: 'loading' })
  const [restart, setRestart] = useState(0)

  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let failures = 0
    let last: Analysis | null = null
    // 다시 요청해 다른 분석으로 옮겨 오면 이전 분석의 화면을 지운다
    setState({ kind: 'loading' })

    const poll = () => {
      getAnalysis(analysisId)
        .then((analysis) => {
          if (cancelled) return
          failures = 0
          last = analysis
          setState({ kind: 'ok', analysis, failures })
          if (analysis.status === 'COMPLETED') {
            navigate(`/analyses/${analysis.analysisId}`, { replace: true })
          } else if (analysis.status !== 'FAILED') {
            timer = setTimeout(poll, nextPollDelay(0))
          }
        })
        .catch((error: unknown) => {
          if (cancelled) return
          failures += 1
          // 없는 분석·잘못된 주소(4xx)는 다시 물어도 같으므로 바로 멈춘다
          const clientError = error instanceof ApiError && error.status >= 400 && error.status < 500
          if (clientError || failures >= MAX_POLL_FAILURES) {
            setState({ kind: 'stopped', error, analysis: last })
            return
          }
          if (last) setState({ kind: 'ok', analysis: last, failures })
          timer = setTimeout(poll, nextPollDelay(failures))
        })
    }
    poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [analysisId, navigate, restart])

  return (
    <section className="page">
      <h1 className="page__title">분석 진행</h1>
      {state.kind === 'loading' && <LoadingState message="분석 상태를 불러오는 중입니다…" />}
      {state.kind === 'stopped' && (
        <>
          {state.analysis && <Progress analysis={state.analysis} />}
          <ErrorState
            error={state.error}
            messages={{ ANALYSIS_NOT_FOUND: '분석을 찾지 못했어요. 처음부터 다시 요청해 주세요.' }}
            onRetry={() => {
              setState({ kind: 'loading' })
              setRestart((n) => n + 1)
            }}
          />
        </>
      )}
      {state.kind === 'ok' && (
        <>
          <Progress analysis={state.analysis} />
          {state.failures > 0 && (
            <p className="progress__retrying" role="status">
              상태를 불러오지 못해 다시 시도하고 있어요({state.failures}/{MAX_POLL_FAILURES - 1}).
            </p>
          )}
          <Outcome key={state.analysis.analysisId} analysis={state.analysis} />
        </>
      )}
    </section>
  )
}

function Progress({ analysis }: { analysis: Analysis }) {
  return (
    <>
      <p className="page__lead">
        {analysis.corpName} · {periodLabel(analysis.previous)} ↔ {periodLabel(analysis.current)}
      </p>
      <section className="panel" aria-label="진행 단계">
        <ol className="steps">
          {analysis.steps.map((step) => (
            <li key={step.step} className={`steps__item steps__item--${step.state.toLowerCase()}`}>
              <span className="steps__marker" aria-hidden="true">
                {step.state === 'DONE' ? '✓' : step.state === 'FAILED' ? '!' : ''}
              </span>
              <span className="steps__label">{step.label}</span>
              <span className="steps__state">{stepStateLabel(step.state)}</span>
            </li>
          ))}
        </ol>
        <div className="progress__status">
          <span className="pair__label">현재 상태</span>
          <span className="badge badge--strong" role="status" aria-live="polite">
            {statusLabel(analysis.status)}
          </span>
        </div>
        <p className="panel__note">{stepSummary(analysis.steps)}</p>
      </section>
    </>
  )
}

function stepStateLabel(state: string): string {
  switch (state) {
    case 'DONE':
      return '완료'
    case 'ACTIVE':
      return '진행 중'
    case 'FAILED':
      return '실패'
    default:
      return '대기'
  }
}

function Outcome({ analysis }: { analysis: Analysis }) {
  const navigate = useNavigate()
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<unknown>(null)
  const compareLink = `/companies/${encodeURIComponent(analysis.corpCode)}/compare?${new URLSearchParams({
    current: analysis.current.rceptNo,
    previous: analysis.previous.rceptNo,
    basis: analysis.basis,
  }).toString()}`

  if (analysis.status === 'COMPLETED') {
    return (
      <div className="progress__outcome">
        <Link to={`/analyses/${analysis.analysisId}`} className="button button--primary">
          결과 보기
        </Link>
      </div>
    )
  }
  if (analysis.status !== 'FAILED' || !analysis.error) return null

  async function retry() {
    setRetrying(true)
    setRetryError(null)
    try {
      const created = await requestAnalysis({
        corpCode: analysis.corpCode,
        currentRceptNo: analysis.current.rceptNo,
        previousRceptNo: analysis.previous.rceptNo,
        basis: analysis.basis,
      })
      navigate(analysisPath(created.analysisId, created.status), { replace: true })
    } catch (error) {
      setRetryError(error)
    } finally {
      setRetrying(false)
    }
  }

  return (
    <div className="not-comparable progress__failed" role="alert">
      <p className="not-comparable__title">분석하지 못했어요.</p>
      <p>{analysis.error.message}</p>
      <p className="state__meta">사유 코드: {analysis.error.code}</p>
      <div className="progress__actions">
        <Link to={compareLink} className="button button--secondary">
          비교 조건 다시 확인
        </Link>
        {analysis.error.retryable && (
          <button type="button" className="button button--primary" onClick={() => void retry()} disabled={retrying}>
            {retrying ? '요청하는 중…' : '다시 요청'}
          </button>
        )}
      </div>
      {retryError !== null && <ErrorState error={retryError} />}
    </div>
  )
}
