import { useState } from 'react'
import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type {
  ActivityEvidence,
  ActivityImpact,
  ActivityItem,
  ActivityQuote,
  ActivityTimelineEntry,
  PeriodActivities,
} from '@/shared/api/activities'
import type { FinancialChangeItem } from '@/shared/api/results'
import { dartViewerUrl } from '@/shared/lib/dart'
import { Badge, Button, Card, Chip, CompareScene, Notice } from '@/shared/ui'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/StateView'
import { useMinimumLoadingState } from '@/shared/hooks/useMinimumLoading'
import { usePeriodActivities } from '../hooks/usePeriodActivities'
import {
  AREA_LABELS,
  AUDIENCE_LABELS,
  AUDIENCE_OPTIONS,
  NO_IMPACT_LINE,
  OUTLOOK_NOTICE,
  OUTLOOK_TAG,
  SIGNAL_NOTICE,
  audienceCount,
  holdReasonText,
  impactKindLabel,
  impactToneLabel,
  itemsFor,
  orderedImpacts,
  sideLabel,
  signalBadge,
  signalCounts,
  timelineDate,
  type AudienceFilter,
} from '../model/periodActivities'
import { KeyNumbers } from './KeyNumbers'

interface ActivityTabProps {
  analysis: Analysis
  /** 카드의 '바뀐 곳에서 원문 비교 보기': 원문 탭의 바뀐 곳에서 그 문장 변경과 근거를 연다 */
  onOpenText: (changeId: number) => void
  /** 핵심 숫자의 '근거 보기': 재무 수치 탭의 그 계정으로 간다 */
  onOpenFinancial: (item: FinancialChangeItem) => void
  /** 원문 탭의 바뀐 곳으로 간다(문장 변경 전체 목록) */
  onOpenAll: () => void
}

/**
 * 공시 분석 탭(ADR-0067). 두 보고서 사이에 회사가 한 일과 앞으로의 영향을
 * 한 문단 요약 → 숫자로 본 이 기간 → 이 기간 타임라인(ADR-0068) → 관점 고르기 → 활동 카드(사실·신호·앞으로의 영향) 순서로 보인다.
 * 바뀐 문장 전체는 원문 탭의 바뀐 곳에 따로 있다.
 */
export function ActivityTab({ analysis, onOpenText, onOpenFinancial, onOpenAll }: ActivityTabProps) {
  const { state, reload } = usePeriodActivities(analysis.analysisId)
  const visibleState = useMinimumLoadingState(state, 1000)
  return (
    <section className="activity" aria-label="공시 분석">
      <header className="activity__head">
        <p className="panel__note">
          {analysis.previous.reportName} → {analysis.current.reportName} · 두 보고서 사이에 회사가 한 일과 앞으로의 영향 중 눈여겨볼 것만 골랐어요. 바뀐 문장 전체는 원문 탭의{' '}
          <Button variant="link" onClick={onOpenAll}>
            바뀐 곳
          </Button>
          에 있어요.
        </p>
      </header>
      {match(visibleState)
        .with({ status: 'loading' }, () => (
          <div className="activity-loading">
            <CompareScene
              previousLabel="이전 보고서"
              currentLabel="현재 보고서"
              chips={[
                { text: '▲ 공급계약', tone: 'modified' },
                { text: '+ 주요활동', tone: 'added' },
                { text: '● 공시신호', tone: 'deleted' },
              ]}
            />
            <LoadingState message="두 보고서 사이의 활동을 정리하는 중이에요. 처음 열면 수십 초 걸릴 수 있어요…" />
          </div>
        ))
        .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
        .with({ status: 'success' }, ({ data }) => (
          <ActivityBody data={data} analysisId={analysis.analysisId} onOpenText={onOpenText} onOpenFinancial={onOpenFinancial} onOpenAll={onOpenAll} />
        ))
        .exhaustive()}
    </section>
  )
}

interface ActivityBodyProps extends Omit<ActivityTabProps, 'analysis'> {
  data: PeriodActivities
  analysisId: number
}

function ActivityBody({ data, analysisId, onOpenText, onOpenFinancial, onOpenAll }: ActivityBodyProps) {
  const numbers = <KeyNumbersBlock analysisId={analysisId} onOpen={onOpenFinancial} />
  return match(data.status)
    .with('GENERATED', () => (
      <>
        {data.overview ? (
          <ActivityOverview text={data.overview.text} evidence={data.overview.evidence} onOpenText={onOpenText} />
        ) : (
          <OverviewMissing />
        )}
        {numbers}
        {data.timeline.length > 0 && <ActivityTimeline entries={data.timeline} onOpenText={onOpenText} />}
        <ActivityList data={data} onOpenText={onOpenText} />
      </>
    ))
    .with('EMPTY', () => (
      <>
        {numbers}
        <EmptyState title="두 보고서 사이에 따로 짚을 만한 활동을 찾지 못했어요">
          <p>바뀐 문장은 있지만 눈여겨볼 활동으로 볼 것이 없었어요.</p>
          <Button variant="secondary" onClick={onOpenAll}>
            바뀐 곳 보기
          </Button>
        </EmptyState>
      </>
    ))
    .with('REVIEW_NEEDED', () => (
      <>
        <Notice tone="attention" title="검토 필요">
          {data.message ?? 'AI가 만든 내용을 원문 근거로 확인하지 못해 보여 주지 않았어요.'} 바뀐 문장은 원문 탭의 바뀐 곳에서 볼 수 있어요.
        </Notice>
        {numbers}
      </>
    ))
    .with('NOT_AVAILABLE', () => (
      <>
        <Notice tone="info" title="확인된 설명 없음">
          {data.message ?? '이 분석은 문장 비교 결과가 없어 활동을 정리할 수 없어요.'}
        </Notice>
        {numbers}
      </>
    ))
    .exhaustive()
}

function KeyNumbersBlock({ analysisId, onOpen }: { analysisId: number; onOpen: (item: FinancialChangeItem) => void }) {
  return (
    <div className="activity__numbers" aria-label="숫자로 본 이 기간">
      <KeyNumbers analysisId={analysisId} onOpen={onOpen} />
    </div>
  )
}

interface ActivityOverviewProps {
  text: string
  evidence: ActivityEvidence[]
  onOpenText: (changeId: number) => void
}

function ActivityOverview({ text, evidence, onOpenText }: ActivityOverviewProps) {
  return (
    <Card as="section" tone="subtle" className="activity__overview" aria-labelledby="activity-overview-title">
      <div className="activity__overview-head">
        <h3 id="activity-overview-title" className="activity__subtitle">
          한 문단 요약
        </h3>
        <Badge tone="accent">AI 생성</Badge>
      </div>
      <p className="activity__overview-text">{text}</p>
      {evidence.length > 0 && (
        <p className="activity__sources">
          근거: <EvidenceLinks evidence={evidence} onOpenText={onOpenText} />
        </p>
      )}
    </Card>
  )
}

/** 요약이 근거 검사를 통과하지 못하면 자리를 비우지 않고 검토 필요로 보인다(ADR-0068) */
function OverviewMissing() {
  return (
    <section className="activity__overview-missing" aria-labelledby="activity-overview-title">
      <h3 id="activity-overview-title" className="activity__subtitle">
        한 문단 요약
      </h3>
      <Notice tone="attention" title="검토 필요">
        AI가 만든 요약을 원문 근거로 확인하지 못해 보여 주지 않았어요. 아래 숫자와 타임라인, 활동은 근거를 확인한 것만 보여요.
      </Notice>
    </section>
  )
}

function ActivityTimeline({
  entries,
  onOpenText,
}: {
  entries: ActivityTimelineEntry[]
  onOpenText: (changeId: number) => void
}) {
  return (
    <section className="activity__timeline-wrap" aria-labelledby="activity-timeline-title">
      <div className="activity__overview-head">
        <h3 id="activity-timeline-title" className="activity__subtitle">
          이 기간 타임라인
        </h3>
        <Badge tone="accent">AI 생성</Badge>
      </div>
      <ol className="activity__timeline">
        {entries.map((entry) => (
          <li key={entry.date + entry.text} className="activity__timeline-row">
            <time className="activity__timeline-date" dateTime={entry.date}>
              {timelineDate(entry.date)}
            </time>
            <span className="activity__timeline-text">{entry.text}</span>
            <span className="activity__sources">
              <EvidenceLinks evidence={entry.evidence} onOpenText={onOpenText} />
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

function EvidenceLinks({
  evidence,
  onOpenText,
}: {
  evidence: ActivityEvidence[]
  onOpenText: (changeId: number) => void
}) {
  return (
    <>
      {evidence.map((item, index) => (
        <span key={item.evidenceId}>
          {index > 0 && ' · '}
          <EvidenceLink evidence={item} onOpenText={onOpenText} />
        </span>
      ))}
    </>
  )
}

/** 공시는 DART 원문으로, 보고서 문장은 원문 탭의 바뀐 곳으로 간다. 재무 수치는 이름만 보인다(숫자 칸에 근거 보기가 있음) */
function EvidenceLink({
  evidence,
  onOpenText,
}: {
  evidence: ActivityEvidence
  onOpenText: (changeId: number) => void
}) {
  const url = evidence.side === 'DISCLOSURE' ? dartViewerUrl(evidence.rceptNo) : null
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer">
        {evidence.sectionPath}
      </a>
    )
  }
  const { changeId } = evidence
  if (changeId !== null) {
    return (
      <Button variant="link" onClick={() => onOpenText(changeId)}>
        {sideLabel(evidence.side)} · {evidence.sectionPath}
      </Button>
    )
  }
  return <>{evidence.sectionPath}</>
}

function ActivityList({ data, onOpenText }: { data: PeriodActivities; onOpenText: (changeId: number) => void }) {
  const [audience, setAudience] = useState<AudienceFilter>(null)
  const shown = itemsFor(data.items, audience)
  const counts = signalCounts(data.items)
  return (
    <section className="activity__list-wrap" aria-labelledby="activity-list-title">
      <div className="activity__list-head">
        <h3 id="activity-list-title" className="activity__subtitle">
          이 기간에 한 일 {data.items.length}건
        </h3>
        <p className="panel__note">
          긍정 {counts.POSITIVE} · 주의 {counts.CAUTION} · 보류 {counts.HOLD}
        </p>
      </div>
      <div className="activity__audiences" role="group" aria-label="관점 고르기">
        {AUDIENCE_OPTIONS.map((option) => (
          <Chip
            key={option.label}
            pressed={audience === option.value}
            count={audienceCount(data.items, option.value)}
            title={option.hint}
            onClick={() => setAudience(option.value)}
          >
            {option.label}
          </Chip>
        ))}
      </div>
      <Notice tone="info">
        {SIGNAL_NOTICE} {OUTLOOK_NOTICE}
      </Notice>
      {shown.length === 0 ? (
        <EmptyState title="이 관점에 맞는 활동이 없어요" />
      ) : (
        <ol className="activity__list">
          {shown.map((item) => (
            <li key={item.no}>
              <ActivityCard item={item} onOpenText={onOpenText} />
            </li>
          ))}
        </ol>
      )}
      {data.droppedCount > 0 && (
        <p className="panel__note">원문 근거를 확인하지 못한 {data.droppedCount}건은 보여 주지 않았어요.</p>
      )}
    </section>
  )
}

function ActivityCard({ item, onOpenText }: { item: ActivityItem; onOpenText: (changeId: number) => void }) {
  const badge = signalBadge(item.signal)
  const hold = holdReasonText(item.signal, item.holdReason)
  const impacts = orderedImpacts(item.impacts)
  const firstChange = item.changeIds[0] ?? null
  return (
    <Card as="article" className="activity-card" aria-labelledby={`activity-${item.no}`}>
      <div className="activity-card__meta">
        <Badge tone="neutral">{AREA_LABELS[item.area]}</Badge>
        <Badge tone={badge.tone}>
          <span aria-hidden="true">{badge.mark} </span>
          {badge.label}
        </Badge>
        <span className="activity-card__audiences">{item.audiences.map((a) => AUDIENCE_LABELS[a]).join(' · ')}</span>
      </div>
      <h4 id={`activity-${item.no}`} className="activity-card__title">
        {item.title}
      </h4>
      <p className="activity-card__summary">{item.summary}</p>
      <p className="activity-card__signal">
        {item.signalKindName} · {item.signalChangeName}
        {hold && <> — {hold}</>}
      </p>

      <div className="activity-card__part">
        <h5 className="activity-card__part-title">공시에 적힌 사실</h5>
        <ul className="activity-card__quotes">
          {item.facts.map((fact) => (
            <QuoteLine key={fact.evidence.evidenceId + fact.quote} quote={fact} />
          ))}
        </ul>
      </div>

      <div className="activity-card__part">
        <h5 className="activity-card__part-title">앞으로의 영향</h5>
        {impacts.length === 0 ? (
          <p className="activity-card__none">{NO_IMPACT_LINE}</p>
        ) : (
          <ul className="activity-card__impacts">
            {impacts.map((impact, index) => (
              <ImpactLine key={index} impact={impact} />
            ))}
          </ul>
        )}
      </div>

      {firstChange !== null && (
        <div className="activity-card__actions">
          <Button variant="secondary" onClick={() => onOpenText(firstChange)}>
            바뀐 곳에서 원문 비교 보기
          </Button>
        </div>
      )}
    </Card>
  )
}

function QuoteLine({ quote }: { quote: ActivityQuote }) {
  return (
    <li className="activity-card__quote">
      <blockquote>“{quote.quote}”</blockquote>
      <span className="activity-card__source">
        {sideLabel(quote.evidence.side)} · {quote.evidence.sectionPath} · 근거 {quote.evidence.evidenceId}
      </span>
    </li>
  )
}

function ImpactLine({ impact }: { impact: ActivityImpact }) {
  const tone = impactToneLabel(impact)
  return (
    <li className={`activity-impact activity-impact--${impact.kind.toLowerCase()}`}>
      <div className="activity-impact__tags">
        {match(impact.kind)
          .with('OUTLOOK', () => <Badge tone="accent">{OUTLOOK_TAG}</Badge>)
          .with('DISCLOSED', () => <Badge tone="neutral">{impactKindLabel(impact.kind)}</Badge>)
          .with('CHECK', () => <Badge tone="neutral">{impactKindLabel(impact.kind)}</Badge>)
          .exhaustive()}
        {tone && (
          <Badge tone={impact.tone === 'GOOD' ? 'positive' : 'attention'}>
            <span aria-hidden="true">{impact.tone === 'GOOD' ? '▲ ' : '▼ '}</span>
            {tone}
          </Badge>
        )}
      </div>
      <p className="activity-impact__text">{impact.text}</p>
      {impact.premises.length > 0 && (
        <ul className="activity-card__quotes activity-impact__premises" aria-label="이 전망의 전제">
          {impact.premises.map((premise) => (
            <QuoteLine key={premise.evidence.evidenceId + premise.quote} quote={premise} />
          ))}
        </ul>
      )}
    </li>
  )
}
