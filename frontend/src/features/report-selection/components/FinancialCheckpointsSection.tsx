import { useId } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import type { CheckpointFact, CheckpointItem, CompanyCheckpoints } from '@/shared/api/checkpoints'
import { formatDate } from '@/shared/lib/reportLabels'
import { Badge, ButtonLink, Card, Notice, Panel, PanelTitle, Skeleton } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { DartSourceLine } from '@/shared/ui/DartSource'
import { ErrorState } from '@/shared/ui/StateView'
import { useCompanyCheckpoints } from '../hooks/useCompanyCheckpoints'
import { useCompletedPairAnalyses } from '../hooks/useCompletedPairAnalyses'
import {
  CHECKPOINT_ERROR_MESSAGES,
  CHECKPOINT_NOTICE,
  checkpointCounts,
  checkpointFsDivLabel,
  checkpointTone,
  exactAmount,
  formatFactValue,
  statementNotice,
} from '../model/checkpoints'
import { checkpointCardAction, findMatchingAnalysis, overviewPairAction } from '../model/overviewAnalysisLink'
import '../report-selection.css'
import '../overview-analysis-links.css'

/**
 * 기업 개요 탭의 '재무 체크 포인트'(FS-62, #479). 최근·전년 사업보고서로 투자자들이 흔히 확인하는 항목을 규칙으로 계산해
 * 항목마다 상태·수치·계산식·기준값·근거와 '왜 보나'를 보여 준다. 서비스는 좋고 나쁨을 판단하지 않고,
 * '확인해 볼 점'만 주의 색 배지, 나머지는 중립색이다.
 */
export function FinancialCheckpointsSection({
  corpCode,
  completedAnalyses,
}: {
  corpCode: string
  completedAnalyses?: readonly CompanyAnalysisItem[]
}) {
  const fetchedAnalyses = useCompletedPairAnalyses(corpCode)
  const analyses = completedAnalyses ?? fetchedAnalyses
  const { state, reload } = useCompanyCheckpoints(corpCode)
  const titleId = useId()
  return (
    <Panel className="checkpoints" aria-labelledby={titleId} aria-busy={state.status === 'loading'}>
      <PanelTitle id={titleId}>재무 체크 포인트</PanelTitle>
      <Notice as="p">{CHECKPOINT_NOTICE}</Notice>
      {match(state)
        .with({ status: 'loading' }, () => (
          <Skeleton label="재무 체크 포인트를 계산하는 중이에요…" shape="card" count={3} height="var(--space-7)" />
        ))
        .with({ status: 'error' }, ({ error }) => (
          <ErrorState error={error} onRetry={reload} messages={CHECKPOINT_ERROR_MESSAGES} />
        ))
        .with({ status: 'success' }, ({ data }) => (
          <CheckpointsBody result={data} corpCode={corpCode} completedAnalyses={analyses} />
        ))
        .exhaustive()}
    </Panel>
  )
}

export function CheckpointsBody({
  result,
  corpCode,
  completedAnalyses = [],
}: {
  result: CompanyCheckpoints
  corpCode?: string
  completedAnalyses?: readonly CompanyAnalysisItem[]
}) {
  return match(result.status)
    .with('NOT_AVAILABLE', () => (
      <Notice role="status" title={result.reason === 'NO_PREVIOUS_REPORT' ? '전년 사업보고서가 없어요' : '사업보고서가 없어요'}>
        <p>{result.message ?? '작년과 견줄 사업보고서가 없어 재무 체크 포인트를 계산할 수 없어요.'}</p>
      </Notice>
    ))
    .with('AVAILABLE', () => <CheckpointList result={result} corpCode={corpCode} completedAnalyses={completedAnalyses} />)
    .exhaustive()
}

function CheckpointList({
  result,
  corpCode,
  completedAnalyses,
}: {
  result: CompanyCheckpoints
  corpCode?: string
  completedAnalyses: readonly CompanyAnalysisItem[]
}) {
  const counts = checkpointCounts(result.items)
  const notice = statementNotice(result)
  const fsDiv = checkpointFsDivLabel(result.fsDiv)
  const reports = [
    ...(result.currentReport ? [{ role: '올해', report: result.currentReport }] : []),
    ...(result.previousReport ? [{ role: '작년', report: result.previousReport }] : []),
  ]
  const prevRceptNo = result.previousReport?.rceptNo
  const curRceptNo = result.currentReport?.rceptNo
  const matching = findMatchingAnalysis(completedAnalyses, prevRceptNo, curRceptNo)
  const pairAction =
    corpCode && prevRceptNo && curRceptNo
      ? overviewPairAction(corpCode, prevRceptNo, curRceptNo, matching?.analysisId ?? null)
      : null

  return (
    <div className="checkpoints__body">
      <div className="checkpoints__summary-row">
        <p className="checkpoints__summary">
          확인해 볼 점 {counts.check}개 · 특이사항 없음 {counts.ok}개 · 자료 없음 {counts.noData}개
          {fsDiv && <span className="checkpoints__basis"> · {fsDiv} 기준</span>}
        </p>
        {pairAction && (
          <ButtonLink to={pairAction.to} variant="secondary">
            {pairAction.label}
          </ButtonLink>
        )}
      </div>
      {notice && (
        <Notice tone="attention" role="status">
          <p>{notice}</p>
        </Notice>
      )}
      <ul className="checkpoints__list">
        {result.items.map((item) => (
          <li key={item.key}>
            <CheckpointCard
              item={item}
              corpCode={corpCode}
              prevRceptNo={prevRceptNo}
              curRceptNo={curRceptNo}
              analysisId={matching?.analysisId ?? null}
            />
          </li>
        ))}
      </ul>
      <DartSourceLine
        reports={reports}
        detail={
          result.disclosureFrom && result.disclosureTo
            ? `공시 ${formatDate(result.disclosureFrom)} ~ ${formatDate(result.disclosureTo)} 접수`
            : undefined
        }
      />
    </div>
  )
}

function CheckpointCard({
  item,
  corpCode,
  prevRceptNo,
  curRceptNo,
  analysisId,
}: {
  item: CheckpointItem
  corpCode?: string
  prevRceptNo?: string
  curRceptNo?: string
  analysisId: number | null
}) {
  const titleId = useId()
  const actionLink =
    corpCode && prevRceptNo && curRceptNo
      ? checkpointCardAction(corpCode, prevRceptNo, curRceptNo, analysisId, item.key, item.status)
      : null

  return (
    <Card as="article" className="checkpoints__card" aria-labelledby={titleId}>
      <div className="checkpoints__head">
        <h3 id={titleId} className="checkpoints__title">
          {item.title}
        </h3>
        <Badge tone={checkpointTone(item.status)}>{item.statusLabel}</Badge>
      </div>
      {item.note && <p className="checkpoints__note">{item.note}</p>}
      <dl className="checkpoints__facts">
        {item.facts.map((fact) => (
          <FactRow key={fact.label} fact={fact} />
        ))}
      </dl>
      <p className="checkpoints__rule">
        <span className="checkpoints__rule-label">계산식</span> {item.formula}
      </p>
      <p className="checkpoints__rule">
        <span className="checkpoints__rule-label">기준값</span> {item.threshold}
      </p>
      {item.disclosures.length > 0 && (
        <ul className="checkpoints__disclosures" aria-label={`${item.title} 공시`}>
          {item.disclosures.map((d) => (
            <li key={d.rceptNo}>
              <time dateTime={d.receivedDate}>{formatDate(d.receivedDate)}</time> {d.reportName}{' '}
              <DartLinkInline rceptNo={d.rceptNo} dartUrl={d.dartUrl} label={d.reportName} />
            </li>
          ))}
        </ul>
      )}
      <details className="checkpoints__why">
        <summary>왜 보나요?</summary>
        <p>{item.why}</p>
      </details>
      {actionLink && (
        <p className="checkpoints__action">
          <Link to={actionLink.to} className="checkpoints__action-link" aria-label={`${item.title} ${actionLink.label}`}>
            {actionLink.label} →
          </Link>
        </p>
      )}
    </Card>
  )
}

function FactRow({ fact }: { fact: CheckpointFact }) {
  const exact = exactAmount(fact)
  const evidence = fact.evidence
  return (
    <div className="checkpoints__fact">
      <dt>{fact.label}</dt>
      <dd>
        <span className="checkpoints__value" title={exact ?? undefined}>
          {formatFactValue(fact)}
        </span>
        {evidence && (
          <span className="checkpoints__evidence">
            {evidence.statementName} · {evidence.accountName} · 접수번호 {evidence.rceptNo}{' '}
            <DartLinkInline rceptNo={evidence.rceptNo} dartUrl={evidence.dartUrl} label={`${fact.label} 근거`} />
          </span>
        )}
      </dd>
    </div>
  )
}
