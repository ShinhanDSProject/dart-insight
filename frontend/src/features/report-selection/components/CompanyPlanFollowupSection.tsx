import { match } from 'ts-pattern'
import type { BriefingReport } from '@/shared/api/briefing'
import type { OutlookEvidence } from '@/shared/api/outlook'
import type { CompanyPlanFollowups, PlanFollowupItem } from '@/shared/api/planFollowups'
import { Badge, Notice, Panel, PanelTitle, Skeleton } from '@/shared/ui'
import { DartLinkInline } from '@/shared/ui/DartLink'
import { ErrorState } from '@/shared/ui/StateView'
import { useCompanyPlanFollowups } from '../hooks/useCompanyPlanFollowups'
import { briefingAiLabel, evidenceLocation } from '../model/companyBriefing'
import { FOLLOWUP_NOTICE, NOT_FOUND_TEXT, PLAN_FOLLOWUP_ERROR_MESSAGES, followupTone } from '../model/planFollowup'
import '../report-selection.css'

const TITLE_ID = 'company-plan-followups-title'

/**
 * 기업 화면 개요 탭 '작년 계획, 올해는'(FS-60, ADR-0041). 작년 사업보고서에서 회사가 밝힌 계획과 올해 사업보고서의
 * 관련 문단을 계획마다 두 칸으로 나란히 보인다(좁은 화면은 위아래). 서비스는 계획을 지켰는지 평가하지 않고,
 * 상태 배지는 중립색만 쓴다. 처음 만드는 기업은 수십 초 걸릴 수 있다.
 */
export function CompanyPlanFollowupSection({ corpCode }: { corpCode: string }) {
  const { state, reload } = useCompanyPlanFollowups(corpCode)
  const result = state.status === 'success' ? state.data : null
  return (
    <Panel className="plan-followups" aria-labelledby={TITLE_ID} aria-busy={state.status === 'loading'}>
      <div className="company-briefing__head">
        <PanelTitle id={TITLE_ID}>작년 계획, 올해는</PanelTitle>
        {result?.aiGenerated && <Badge tone="accent">AI 생성</Badge>}
      </div>
      {match(state)
        .with({ status: 'loading' }, () => (
          <Skeleton
            label="작년 사업보고서의 계획과 올해 사업보고서 문단을 나란히 놓는 중이에요. 처음 여는 기업은 수십 초 걸릴 수 있어요."
            shape="line"
            count={4}
          />
        ))
        .with({ status: 'error' }, ({ error }) => (
          <ErrorState error={error} onRetry={reload} messages={PLAN_FOLLOWUP_ERROR_MESSAGES} />
        ))
        .with({ status: 'success' }, ({ data }) => <PlanFollowupBody result={data} />)
        .exhaustive()}
    </Panel>
  )
}

export function PlanFollowupBody({ result }: { result: CompanyPlanFollowups }) {
  return (
    <>
      <SourceReports previous={result.previousReport} current={result.currentReport} />
      {match(result.status)
        .with('GENERATED', () => (
          <ol className="plan-followups__list">
            {result.items.map((item) => (
              <PlanRow key={item.planNo} item={item} previous={result.previousReport} current={result.currentReport} />
            ))}
          </ol>
        ))
        .with('EMPTY', () => (
          <Notice role="status" title="작년 계획이 없어요">
            <p>{result.message ?? '작년 사업보고서에서 회사가 밝힌 투자·사업·재무 계획을 찾지 못했어요.'}</p>
          </Notice>
        ))
        .with('REVIEW_NEEDED', () => (
          <Notice tone="attention" role="status" title="검토 필요">
            <p>{result.message ?? '근거와 인용을 확인하지 못해 대조 결과를 보여 주지 않아요.'} 원문에서 직접 확인해 주세요.</p>
          </Notice>
        ))
        .with('NOT_AVAILABLE', () => (
          <Notice role="status" title={result.reason === 'NO_PREVIOUS_REPORT' ? '이전 사업보고서가 없어요' : '나란히 볼 수 없어요'}>
            <p>{result.message ?? '작년 계획과 나란히 볼 보고서가 없어요.'}</p>
          </Notice>
        ))
        .exhaustive()}
      <p className="company-briefing__meta">
        {FOLLOWUP_NOTICE} 투자 판단의 근거가 아니며, 정확한 내용은 근거 원문에서 확인해 주세요.
        {result.aiGenerated && result.ai && (
          <span className="company-briefing__model"> 요지와 관련 문단은 AI가 골랐어요 · {briefingAiLabel(result.ai)}</span>
        )}
      </p>
    </>
  )
}

function SourceReports({ previous, current }: { previous: BriefingReport | null; current: BriefingReport | null }) {
  if (!previous && !current) return null
  return (
    <p className="company-briefing__source">
      출처: DART
      {previous && (
        <>
          {' '}
          · 작년 <span>{previous.reportName}</span>{' '}
          <DartLinkInline rceptNo={previous.rceptNo} dartUrl={previous.dartUrl} label={`작년 ${previous.reportName}`} />
        </>
      )}
      {current && (
        <>
          {' '}
          · 올해 <span>{current.reportName}</span>{' '}
          <DartLinkInline rceptNo={current.rceptNo} dartUrl={current.dartUrl} label={`올해 ${current.reportName}`} />
        </>
      )}
    </p>
  )
}

function PlanRow({
  item,
  previous,
  current,
}: {
  item: PlanFollowupItem
  previous: BriefingReport | null
  current: BriefingReport | null
}) {
  const { plan, followup } = item
  return (
    <li className="plan-followups__item" aria-labelledby={`plan-followup-${item.planNo}`}>
      <h3 id={`plan-followup-${item.planNo}`} className="plan-followups__title">
        {item.planNo}. {item.categoryLabel} <Badge tone={followupTone(followup.status)}>{followup.statusLabel}</Badge>
      </h3>
      <div className="plan-followups__columns">
        <section className="plan-followups__side" aria-label={`${item.planNo}번 작년 계획`}>
          <p className="plan-followups__label">작년 계획</p>
          <p className="company-briefing__text">{plan.summary}</p>
          <blockquote className="company-outlook__quote">
            <p>“{plan.quote}”</p>
          </blockquote>
          <Evidence evidence={plan.evidence} report={previous} label={`${item.planNo}번 작년 계획 근거 보고서`} />
        </section>
        <section className="plan-followups__side" aria-label={`${item.planNo}번 올해 보고서`}>
          <p className="plan-followups__label">올해 보고서</p>
          {followup.summary && followup.quote && followup.evidence ? (
            <>
              <p className="company-briefing__text">{followup.summary}</p>
              <blockquote className="company-outlook__quote">
                <p>“{followup.quote}”</p>
              </blockquote>
              <Evidence evidence={followup.evidence} report={current} label={`${item.planNo}번 올해 문단 근거 보고서`} />
            </>
          ) : (
            <p className="plan-followups__empty">{NOT_FOUND_TEXT}</p>
          )}
        </section>
      </div>
    </li>
  )
}

function Evidence({ evidence, report, label }: { evidence: OutlookEvidence; report: BriefingReport | null; label: string }) {
  return (
    <p className="company-outlook__location">
      근거: {evidenceLocation(evidence)}
      {report && (
        <>
          {' '}
          · 원문 <DartLinkInline rceptNo={report.rceptNo} dartUrl={report.dartUrl} label={label} />
        </>
      )}
    </p>
  )
}
