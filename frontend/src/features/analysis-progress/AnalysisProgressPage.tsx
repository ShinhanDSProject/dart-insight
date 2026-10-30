import { Link, useNavigate, useParams } from 'react-router'
import { match, P } from 'ts-pattern'
import { analysisPath, requestAnalysis, type Analysis } from '@/shared/api/analyses'
import { useAsyncAction } from '@/shared/hooks/useAsyncAction'
import {
  Badge,
  Button,
  ButtonLink,
  Notice,
  Page,
  PageHeader,
  Panel,
  PanelTitle,
  ProgressBar,
  ReportCard,
  ReportCardPair,
} from '@/shared/ui'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { NotifyControl } from './components/NotifyControl'
import { useAnalysisProgress } from './hooks/useAnalysisProgress'
import { useCompletionNotification } from './hooks/useCompletionNotification'
import { useProgressTitle } from './hooks/useProgressTitle'
import {
  MAX_POLL_FAILURES,
  progressHeader,
  stepMarker,
  stepProgress,
  stepStateLabel,
  stepSummary,
} from './model/progress'
import { useRecordCurrentCompany } from '@/shared/hooks/useCurrentCompany'
import './analysis-progress.css'

/**
 * W-02 분석 진행(2.3). 1초마다 상태를 묻고, 완료되면 결과 화면(W-03)으로 간다.
 * 실패하면 사유와 '분석 실행'(다시 요청)을 보여 준다. 결과가 저장되기 전에는 완료로 보이지 않는다(서버가 보장).
 * 탭 제목에 상태를 보이고, 원하면 탭이 숨겨진 채 끝났을 때 브라우저 알림을 띄운다(4.3).
 * 배치(#549): 화면 머리(상태 배지) → 이전·현재 보고서 카드 → 단계 카드와 진행 막대 → 실패 안내·다음 행동.
 */
export function AnalysisProgressPage() {
  const { analysisId = '' } = useParams()
  const { permission, requestPermission, notify } = useCompletionNotification()
  const { state, restart } = useAnalysisProgress(analysisId, { onSettled: notify })
  const analysis = match(state)
    .with({ status: 'success' }, ({ data }) => data)
    .with({ status: 'error' }, ({ data }) => data)
    .with({ status: 'loading' }, () => null)
    .exhaustive()
  useProgressTitle(analysis)

  return (
    <Page>
      {analysis === null ? <PageHeader title="분석 진행" /> : <ProgressHeading analysis={analysis} />}
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
            {match(data.status)
              .with('PENDING', 'RUNNING', () => (
                <NotifyControl permission={permission} onRequest={() => void requestPermission()} />
              ))
              .with('COMPLETED', 'FAILED', () => null)
              .exhaustive()}
            <Outcome key={data.analysisId} analysis={data} />
          </>
        ))
        .exhaustive()}
    </Page>
  )
}

/** 비교 확인 화면 주소(같은 기업·보고서·비교 기준) */
function compareLinkOf(analysis: Analysis): string {
  return `/companies/${encodeURIComponent(analysis.corpCode)}/compare?${new URLSearchParams({
    current: analysis.current.rceptNo,
    previous: analysis.previous.rceptNo,
    basis: analysis.basis,
  }).toString()}`
}

/** 보고서 선택 화면 주소(같은 보고서·비교 기준을 고른 채로) */
function selectLinkOf(analysis: Analysis): string {
  return `/companies/${encodeURIComponent(analysis.corpCode)}?${new URLSearchParams({
    current: analysis.current.rceptNo,
    previous: analysis.previous.rceptNo,
    basis: analysis.basis,
  }).toString()}`
}

function ProgressHeading({ analysis }: { analysis: Analysis }) {
  const header = progressHeader(analysis.status)
  return (
    <PageHeader
      breadcrumb={
        <>
          <Link to={selectLinkOf(analysis)}>보고서 선택</Link> / <Link to={compareLinkOf(analysis)}>비교 조건 확인</Link> /
          분석 진행
        </>
      }
      title={header.title}
      lead={`${analysis.corpName} · ${analysis.previous.reportName} → ${analysis.current.reportName}`}
      aside={
        <Badge tone={header.badge.tone} role="status" aria-live="polite">
          {header.badge.label}
        </Badge>
      }
    />
  )
}

function Progress({ analysis }: { analysis: Analysis }) {
  // 상단 바 아래 '지금 보는 기업'을 이 기업으로 바꾼다. 아직 결과가 없어 분석은 넘기지 않는다(#502)
  useRecordCurrentCompany({ corpCode: analysis.corpCode, corpName: analysis.corpName })
  return (
    <>
      <ReportCardPair>
        <ReportCard side="previous" report={analysis.previous} />
        <ReportCard side="current" report={analysis.current} />
      </ReportCardPair>
      <Panel aria-labelledby="progress-steps-title">
        <PanelTitle id="progress-steps-title">원문에서 근거까지, 순서대로 확인해요</PanelTitle>
        <ol className="steps">
          {analysis.steps.map((step) => (
            <li key={step.step} className={`steps__item steps__item--${step.state.toLowerCase()}`}>
              <span className="steps__label">
                <span className="steps__marker" aria-hidden="true">
                  {stepMarker(step.state)}
                </span>
                {step.label}
              </span>
              <span className="steps__state">{stepStateLabel(step.state)}</span>
            </li>
          ))}
        </ol>
        <ProgressBar value={stepProgress(analysis.steps)} label="분석 진행률" />
        <p className="panel__note">{stepSummary(analysis.steps)}</p>
      </Panel>
    </>
  )
}

function Outcome({ analysis }: { analysis: Analysis }) {
  const navigate = useNavigate()
  const retry = useAsyncAction<void>()

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
      <div className="progress__actions">
        <ButtonLink to={`/analyses/${analysis.analysisId}`} variant="primary">
          결과 보기
        </ButtonLink>
      </div>
    ))
    .with({ status: 'FAILED', error: P.nonNullable }, ({ error }) => (
      <>
        <Notice tone="blocked" title="분석에 실패했어요" className="progress__failed" role="alert">
          <p>{error.message} 확인되지 않은 결과는 보여 드리지 않아요.</p>
          <p className="state__meta">사유 코드: {error.code}</p>
        </Notice>
        <div className="progress__actions progress__actions--split">
          <ButtonLink to={selectLinkOf(analysis)} variant="secondary">
            보고서 다시 선택
          </ButtonLink>
          {error.retryable && (
            <Button variant="primary" onClick={requestAgain} disabled={retry.state.status === 'loading'}>
              {retry.state.status === 'loading' ? '요청하는 중…' : '↻ 분석 실행'}
            </Button>
          )}
        </div>
        {match(retry.state)
          .with({ status: 'error' }, ({ error: retryError }) => <ErrorState error={retryError} />)
          .with({ status: P.union('idle', 'loading', 'success') }, () => null)
          .exhaustive()}
      </>
    ))
    // 진행 중이거나 실패 사유가 없으면 보여 줄 것이 없다
    .with({ status: P.union('PENDING', 'RUNNING', 'FAILED') }, () => null)
    .exhaustive()
}
