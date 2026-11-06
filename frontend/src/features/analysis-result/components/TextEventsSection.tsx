import { useState, type ReactNode } from 'react'
import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { TextChangeItem } from '@/shared/api/textChanges'
import type { TextEventItem, TextEventList, TextEventQuote, TextEventUnboundChange } from '@/shared/api/textEvents'
import { Badge, Button, Card, Notice, Skeleton } from '@/shared/ui'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { displaySectionPath } from '@/shared/lib/sectionTitle'
import { useSignalTable, useTextEventDetail } from '../hooks/useTextEvents'
import { kindBadge, signalBadge } from '../model/eventSignal'
import {
  CHANGE_QUOTES_TITLE,
  EVENT_CHANGES_PAGE_SIZE,
  EVENTS_BUILDING,
  EVENTS_DROPPED_NOTE,
  EVENTS_EMPTY,
  EVENTS_LOADING,
  EVENTS_NOTE,
  EVENTS_RETRY_LIMITED,
  EVENTS_TITLE,
  EVENTS_UNAVAILABLE,
  eventQuotes,
  eventScaleView,
  eventsNarrowed,
  NO_QUOTE,
  NO_REASON,
  REASON_QUOTES_TITLE,
  SCALE_AMOUNT_LABEL,
  SCALE_CONVERTED_LABEL,
  UNBOUND_NOTE,
  UNBOUND_TITLE,
  visibleEvents,
  visibleUnbound,
  type EventScope,
  type TextEventsView,
} from '../model/textEvents'
import { textFieldLabel } from '../model/textFields'
import { resultCountLabel } from '../model/textFilter'
import { changeTypeLabel, missingSideLabel } from '../model/textLabels'
import { SidePreview } from './SidePreview'
import { MeaningPart, SignalCriteriaDialog, SignalReasonPart } from './TextEventSignalParts'
import { TextListFooter } from './TextListFooter'

interface TextEventsSectionProps {
  analysis: Analysis
  list: TextEventList
  /** 지금 보여 줄 사건(거르기를 반영함) */
  items: TextEventItem[]
  /** 인용이 나온 변경의 원문 비교를 연다 */
  onOpenEvidence: (changeId: number) => void
  /** 묶인 변경을 변경 카드 목록으로 그린다 */
  renderChanges: (items: TextChangeItem[], eventId: number) => ReactNode
}

type TextEventsAreaProps = Omit<TextEventsSectionProps, 'list' | 'items'> & {
  view: TextEventsView
  scope: EventScope
  onRetry: () => void
}

/** 분야별 표 아래의 사건 자리(3.38). 사건을 만드는 중이거나 만들지 못해도 탭의 나머지는 그대로 쓴다 */
export function TextEventsArea({ analysis, view, scope, onRetry, onOpenEvidence, renderChanges }: TextEventsAreaProps) {
  if (eventsNarrowed(scope)) return null
  return match(view)
    .with({ status: 'hidden' }, () => null)
    .with({ status: 'building' }, () => <LoadingState message={EVENTS_BUILDING} />)
    .with({ status: 'loading' }, () => <Skeleton label={EVENTS_LOADING} shape="card" count={1} />)
    .with({ status: 'unavailable' }, ({ retry }) => (
      <Notice tone="attention" role="status" className="text-events__notice">
        <p>
          {EVENTS_UNAVAILABLE}
          {retry === 'limited' && ` ${EVENTS_RETRY_LIMITED}`}
        </p>
        {retry === 'available' && (
          <Button variant="secondary" onClick={onRetry}>
            다시 시도
          </Button>
        )}
      </Notice>
    ))
    .with({ status: 'empty' }, () => (
      <Notice as="p" role="status">
        {EVENTS_EMPTY}
      </Notice>
    ))
    .with({ status: 'ready' }, ({ list }) => (
      <>
        <TextEventsSection analysis={analysis} list={list} items={visibleEvents(list.items, scope)} onOpenEvidence={onOpenEvidence} renderChanges={renderChanges} />
        <UnboundChanges analysis={analysis} changes={visibleUnbound(list.unboundChanges, scope)} onOpenEvidence={onOpenEvidence} />
      </>
    ))
    .exhaustive()
}

/**
 * 분야별 표 아래의 주요 사건(3.37). 순서는 서버가 정한 그대로이고, 카드를 펼치면 인용, 사건 문장, 묶인 변경을 본다.
 * 신호를 보여 주므로 기준표의 안내를 함께 둔다(ADR-0060). 기준표를 받지 못해도 '투자 판단이나 추천이 아니에요'는 남는다
 */
export function TextEventsSection({ analysis, list, items, onOpenEvidence, renderChanges }: TextEventsSectionProps) {
  const { state: table, reload } = useSignalTable()
  const [criteriaFor, setCriteriaFor] = useState<TextEventItem | null>(null)
  if (items.length === 0) return null
  return (
    <section className="text-events" aria-labelledby="text-events-title">
      <h3 id="text-events-title" className="text-events__title">
        {EVENTS_TITLE} {resultCountLabel(items.length)}
      </h3>
      <p className="panel__note">{EVENTS_NOTE}</p>
      {table.status === 'success' && <p className="panel__note">{table.data.signalNotice}</p>}
      {list.droppedEventCount > 0 && (
        <Notice as="p" tone="attention">
          {EVENTS_DROPPED_NOTE}
        </Notice>
      )}
      <ol className="text-events__list">
        {items.map((item) => (
          <li key={item.eventId}>
            <TextEventCard analysis={analysis} item={item} onOpenEvidence={onOpenEvidence} onOpenCriteria={() => setCriteriaFor(item)} renderChanges={renderChanges} />
          </li>
        ))}
      </ol>
      {criteriaFor !== null && <SignalCriteriaDialog item={criteriaFor} table={table} onRetry={reload} onClose={() => setCriteriaFor(null)} />}
    </section>
  )
}

interface UnboundChangesProps {
  analysis: Analysis
  changes: TextEventUnboundChange[]
  onOpenEvidence: (changeId: number) => void
}

/** 후보였지만 어느 사건에도 들어가지 않은 변경(AC22). AI가 쓴 글이 없어 AI 표시를 두지 않는다. 응답에 전부 오므로 화면에서만 나눠 보인다 */
function UnboundChanges({ analysis, changes, onOpenEvidence }: UnboundChangesProps) {
  const [shown, setShown] = useState(EVENT_CHANGES_PAGE_SIZE)
  if (changes.length === 0) return null
  const items = changes.slice(0, shown)
  return (
    <section className="text-events" aria-labelledby="text-events-unbound-title">
      <h3 id="text-events-unbound-title" className="text-events__title">
        {UNBOUND_TITLE} {resultCountLabel(changes.length)}
      </h3>
      <p className="panel__note">{UNBOUND_NOTE}</p>
      <ol className="text-events__list">
        {items.map((change) => (
          <li key={change.changeId}>
            <UnboundCard analysis={analysis} change={change} onOpenEvidence={onOpenEvidence} />
          </li>
        ))}
      </ol>
      <TextListFooter loaded={items.length} total={changes.length} more={{ status: 'idle' }} onMore={() => setShown(shown + EVENT_CHANGES_PAGE_SIZE)} />
    </section>
  )
}

function UnboundCard({ analysis, change, onOpenEvidence }: { analysis: Analysis; change: TextEventUnboundChange; onOpenEvidence: (changeId: number) => void }) {
  const section = displaySectionPath(change.sectionPath)
  return (
    <Card as="article" className="text-event" aria-label={section}>
      <div className="text-event__head">
        <h4 className="text-event__title">{section}</h4>
        <Badge tone="accent">{changeTypeLabel(change.changeType)}</Badge>
        {change.field !== null && <Badge>{textFieldLabel(change.field)}</Badge>}
      </div>
      <div className="change-card__sides change-card__sides--clamped">
        <SidePreview role={`이전 · ${analysis.previous.reportName}`} text={change.previousPreview} missing={missingSideLabel(change.changeType, 'previous')} />
        <SidePreview role={`이번 · ${analysis.current.reportName}`} text={change.currentPreview} missing={missingSideLabel(change.changeType, 'current')} />
      </div>
      <Button variant="secondary" className="text-event__actions" aria-haspopup="dialog" onClick={() => onOpenEvidence(change.changeId)}>
        원문 비교
      </Button>
    </Card>
  )
}

type TextEventCardProps = Omit<TextEventsSectionProps, 'list' | 'items'> & { item: TextEventItem; onOpenCriteria: () => void }

function TextEventCard({ analysis, item, onOpenEvidence, onOpenCriteria, renderChanges }: TextEventCardProps) {
  const [open, setOpen] = useState(false)
  const [showChanges, setShowChanges] = useState(false)
  const bodyId = `text-event-${item.eventId}`
  const changesId = `text-event-changes-${item.eventId}`
  const quotes = eventQuotes(item)
  const scale = eventScaleView(item)
  const signal = signalBadge(item.signal)
  const kind = kindBadge(item)
  const quoteList = (entries: TextEventQuote[]) =>
    entries.map((quote, index) => <QuoteBlock key={`${quote.evidenceId}-${index}`} quote={quote} onOpenEvidence={onOpenEvidence} />)
  return (
    <Card as="article" className="text-event" aria-label={item.title}>
      <div className="text-event__head">
        <h4 className="text-event__title">{item.title}</h4>
        <Badge tone={signal.tone}>{signal.label}</Badge>
        <Badge tone="accent">AI 생성</Badge>
        {kind !== null && <Badge>{kind}</Badge>}
      </div>
      {scale !== null && (
        <dl className="text-event__scale">
          <div>
            <dt>{SCALE_AMOUNT_LABEL}</dt>
            <dd className="text-event__amount">{scale.amount}</dd>
          </div>
          {scale.converted !== null && (
            <div>
              <dt>{SCALE_CONVERTED_LABEL}</dt>
              <dd>{scale.converted}</dd>
            </div>
          )}
          <div>
            <dt>근거 ID</dt>
            <dd>{scale.evidenceId === null ? <Badge tone="attention">검토 필요</Badge> : <code>{scale.evidenceId}</code>}</dd>
          </div>
        </dl>
      )}
      <Button variant="secondary" className="text-event__actions" aria-expanded={open} aria-controls={open ? bodyId : undefined} onClick={() => setOpen(!open)}>
        {open ? '접기' : '펼치기'}
      </Button>
      {open && (
        <div id={bodyId} className="text-event__body">
          <div className="text-event__part">
            <h5 className="text-event__part-title">{CHANGE_QUOTES_TITLE}</h5>
            <div className="change-card__sides">
              <div className="change-side text-event__quotes">
                <span className="change-side__role">이전 · {analysis.previous.reportName}</span>
                {quotes.previous.length > 0 ? quoteList(quotes.previous) : <p className="change-side__missing">{NO_QUOTE}</p>}
              </div>
              <div className="change-side text-event__quotes">
                <span className="change-side__role">이번 · {analysis.current.reportName}</span>
                {quotes.current.length > 0 ? quoteList(quotes.current) : <p className="change-side__missing">{NO_QUOTE}</p>}
              </div>
            </div>
          </div>
          <div className="text-event__part">
            <h5 className="text-event__part-title">{REASON_QUOTES_TITLE}</h5>
            {quotes.reasons.length > 0 ? (
              <div className="change-side text-event__quotes">{quoteList(quotes.reasons)}</div>
            ) : (
              <p className="panel__note">{NO_REASON}</p>
            )}
          </div>
          <MeaningPart item={item} onOpenEvidence={onOpenEvidence} />
          <SignalReasonPart item={item} onOpenEvidence={onOpenEvidence} onOpenCriteria={onOpenCriteria} />
          <Button
            variant="secondary"
            className="text-event__actions"
            aria-expanded={showChanges}
            aria-controls={showChanges ? changesId : undefined}
            onClick={() => setShowChanges(!showChanges)}
          >
            {showChanges ? '변경 접기' : `변경 보기 ${resultCountLabel(item.changeIds.length)}`}
          </Button>
          {showChanges && (
            <div id={changesId} className="text-event__part">
              <EventChanges analysisId={analysis.analysisId} eventId={item.eventId} renderChanges={renderChanges} />
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

function QuoteBlock({ quote, onOpenEvidence }: { quote: TextEventQuote; onOpenEvidence: (changeId: number) => void }) {
  return (
    <div className="text-event__quote">
      <p className="change-side__text">{quote.text}</p>
      <div className="text-event__source">
        <span title={`근거 ID ${quote.evidenceId}`}>{displaySectionPath(quote.sectionPath)}</span>
        <Button variant="link" aria-haspopup="dialog" onClick={() => onOpenEvidence(quote.changeId)}>
          원문 비교
        </Button>
      </div>
    </div>
  )
}

interface EventChangesProps {
  analysisId: number
  eventId: number
  renderChanges: TextEventsSectionProps['renderChanges']
}

/** 사건에 묶인 변경. 응답에 전부 오므로 화면에서만 나눠 보인다 */
function EventChanges({ analysisId, eventId, renderChanges }: EventChangesProps) {
  const { state, reload } = useTextEventDetail(analysisId, eventId)
  const [shown, setShown] = useState(EVENT_CHANGES_PAGE_SIZE)
  return match(state)
    .with({ status: 'loading' }, () => <Skeleton label="묶인 변경을 불러오는 중입니다…" shape="card" count={2} />)
    .with({ status: 'error' }, ({ error }) => <ErrorState error={error} onRetry={reload} />)
    .with({ status: 'success' }, ({ data }) => {
      const items = data.changes.slice(0, shown)
      return (
        <>
          {renderChanges(items, eventId)}
          <TextListFooter loaded={items.length} total={data.changes.length} more={{ status: 'idle' }} onMore={() => setShown(shown + EVENT_CHANGES_PAGE_SIZE)} />
        </>
      )
    })
    .exhaustive()
}
