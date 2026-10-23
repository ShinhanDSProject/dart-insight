import { useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { analysisPath, requestAnalysis, type Analysis } from '@/shared/api/analyses'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import { Badge, Button, ButtonLink, FieldLabel, Notice, Panel } from '@/shared/ui'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { periodLabel } from '@/shared/lib/reportLabels'
import { useAnalysisProgress } from './hooks/useAnalysisProgress'
import { MAX_POLL_FAILURES, statusLabel, stepMarker, stepStateLabel, stepSummary } from './model/progress'
import './analysis-progress.css'

/**
 * W-02 분석 진행(2.3). 1초마다 상태를 묻고, 완료되면 결과 화면(W-03)으로 간다.
 * 실패하면 사유와 '다시 요청'을 보여 준다. 결과가 저장되기 전에는 완료로 보이지 않는다(서버가 보장).
 */
export function AnalysisProgressPage() {
  const { analysisId = '' } = useParams()
  const { state, restart } = useAnalysisProgress(analysisId)

  return (
    <section className="page">
      <h1 className="page__title">분석 진행</h1>
      {match(state)
        .with({ status: 'loading' }, () => <LoadingState message="분석 상태를 불러오는 중입니다…" />)
        .with({ status: 'error' }, ({ error, data }) => (
          <>
            {data && <Progress analysis={data} />}
            <ErrorState
              error={error}
              messages={{ ANALYSIS_NOT_FOUND: '분석을 찾지 못했어요. 처음부터 다시 요청해 주세요.' }}
              onRetry={restart}
            />
          </>
        ))
        .with({ status: 'success' }, ({ data, failures }) => (
          <>
            <Progress analysis={data} />
            {failures > 0 && (
              <p className="progress__retrying" role="status">
                상태를 불러오지 못해 다시 시도하고 있어요({failures}/{MAX_POLL_FAILURES - 1}).
              </p>
            )}
            <Outcome key={data.analysisId} analysis={data} />
          </>
        ))
        .exhaustive()}
    </section>
  )
}

function Progress({ analysis }: { analysis: Analysis }) {
  return (
    <>
      <p className="page__lead">
        {analysis.corpName} · {periodLabel(analysis.previous)} ↔ {periodLabel(analysis.current)}
      </p>
      <Panel aria-label="진행 단계">
        <ol className="steps">
          {analysis.steps.map((step) => (
            <li key={step.step} className={`steps__item steps__item--${step.state.toLowerCase()}`}>
              <span className="steps__marker" aria-hidden="true">
                {stepMarker(step.state)}
              </span>
              <span className="steps__label">{step.label}</span>
              <span className="steps__state">{stepStateLabel(step.state)}</span>
            </li>
          ))}
        </ol>
        <div className="progress__status">
          <FieldLabel as="span">현재 상태</FieldLabel>
          <Badge tone="accent" role="status" aria-live="polite">
            {statusLabel(analysis.status)}
          </Badge>
        </div>
        <p className="panel__note">{stepSummary(analysis.steps)}</p>
      </Panel>
    </>
  )
}

function Outcome({ analysis }: { analysis: Analysis }) {
  const navigate = useNavigate()
  const retry = useAsyncAction<void>()
  const compareLink = `/companies/${encodeURIComponent(analysis.corpCode)}/compare?${new URLSearchParams({
    current: analysis.current.rceptNo,
    previous: analysis.previous.rceptNo,
    basis: analysis.basis,
  }).toString()}`

  function requestAgain() {
    void retry.run(async () => {
      const created = await requestAnalysis({
        corpCode: analysis.corpCode,
        currentRceptNo: analysis.current.rceptNo,
        previousRceptNo: analysis.previous.rceptNo,
        basis: analysis.basis,
      })
      navigate(analysisPath(created.analysisId, created.status), { replace: true })
    })
  }

  return match(analysis)
    .with({ status: 'COMPLETED' }, () => (
      <div className="progress__outcome">
        <ButtonLink to={`/analyses/${analysis.analysisId}`} variant="primary">
          결과 보기
        </ButtonLink>
      </div>
    ))
    .with({ status: 'FAILED', error: P.nonNullable }, ({ error }) => (
      <Notice tone="blocked" title="분석하지 못했어요." className="progress__failed" role="alert">
        <p>{error.message}</p>
        <p className="state__meta">사유 코드: {error.code}</p>
        <div className="progress__actions">
          <ButtonLink to={compareLink} variant="secondary">
            비교 조건 다시 확인
          </ButtonLink>
          {error.retryable && (
            <Button variant="primary" onClick={requestAgain} disabled={retry.state.status === 'loading'}>
              {retry.state.status === 'loading' ? '요청하는 중…' : '다시 요청'}
            </Button>
          )}
        </div>
        {match(retry.state)
          .with({ status: 'error' }, ({ error: retryError }) => <ErrorState error={retryError} />)
          .with({ status: P.union('idle', 'loading', 'success') }, () => null)
          .exhaustive()}
      </Notice>
    ))
    // 진행 중이거나 실패 사유가 없으면 보여 줄 것이 없다
    .with({ status: P.union('PENDING', 'RUNNING', 'FAILED') }, () => null)
    .exhaustive()
}
