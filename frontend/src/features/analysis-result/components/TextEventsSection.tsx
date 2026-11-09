import { useState, type ReactNode } from 'react'
import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { TextChangeItem } from '@/shared/api/textChanges'
import type { TextEventItem, TextEventList, TextEventQuote, TextEventSignal } from '@/shared/api/textEvents'
import { Badge, Button, Chip, Notice, Skeleton } from '@/shared/ui'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { displaySectionPath } from '@/shared/lib/sectionTitle'
import { useSignalTable, useTextEventDetail } from '../hooks/useTextEvents'
import { eventsBySignal, SIGNAL_FILTER_LABEL, SIGNAL_FILTERS, signalBadge, signalEmptyText, signalFilterCount } from '../model/eventSignal'
import {
  CHANGE_QUOTES_TITLE,
  EVENT_CHANGES_PAGE_SIZE,
  EVENTS_BUILDING,
  EVENTS_DROPPED_NOTE,
  EVENTS_EMPTY,
  EVENTS_INITIAL,
  EVENTS_LOADING,
  EVENTS_NOTE,
  EVENTS_RETRY_LIMITED,
  EVENTS_TITLE,
  EVENTS_UNAVAILABLE,
  eventQuotes,
  eventRowMeta,
  eventScaleView,
  eventsMoreLabel,
  eventsNarrowed,
  NO_QUOTE,
  NO_REASON,
  REASON_QUOTES_TITLE,
  SCALE_AMOUNT_LABEL,
  SCALE_CONVERTED_LABEL,
  unboundNote,
  visibleEvents,
  visibleUnbound,
  type EventScope,
  type TextEventsView,
} from '../model/textEvents'
import { resultCountLabel } from '../model/textFilter'
import { FactsPart } from './TextEventFactsPart'
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
        <UnboundNote count={visibleUnbound(list.unboundChanges, scope).length} />
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
  const [signal, setSignal] = useState<TextEventSignal | null>(null)
  const [showAll, setShowAll] = useState(false)
  // 신호를 바꾸면 거른 사건도 처음 몇 건부터 다시 보인다
  const chooseSignal = (next: TextEventSignal | null) => {
    setSignal(next)
    setShowAll(false)
  }
  if (items.length === 0) return null
  const filtered = eventsBySignal(items, signal)
  // 처음에는 몇 건만 보이고 나머지는 더 보기로 연다(3.58)
  const shown = showAll ? filtered : filtered.slice(0, EVENTS_INITIAL)
  const hidden = filtered.length - shown.length
  return (
    <section className="text-events" aria-labelledby="text-events-title">
      {/* 제목과 안내를 한 줄에(3.55 → 3.58) */}
      <div className="text-events__head">
        <h3 id="text-events-title" className="text-events__title">
          {EVENTS_TITLE} {resultCountLabel(filtered.length)}
        </h3>
        <p className="panel__note">
          {EVENTS_NOTE}
          {table.status === 'success' && ` ${table.data.signalNotice}`}
        </p>
      </div>
      {list.droppedEventCount > 0 && (
        <Notice as="p" tone="attention">
          {EVENTS_DROPPED_NOTE}
        </Notice>
      )}
      {(items.length > 1 || signal !== null) && <SignalFilter items={items} signal={signal} onChange={chooseSignal} />}
      {signal !== null && shown.length === 0 && (
        <Notice as="p" role="status">
          {signalEmptyText(signal)}
        </Notice>
      )}
      <ol className="text-events__list text-events__list--rows">
        {shown.map((item) => (
          <li key={item.eventId}>
            <TextEventCard analysis={analysis} item={item} onOpenEvidence={onOpenEvidence} onOpenCriteria={() => setCriteriaFor(item)} renderChanges={renderChanges} />
          </li>
        ))}
      </ol>
      {hidden > 0 && (
        <Button variant="link" className="text-events__more" onClick={() => setShowAll(true)}>
          {eventsMoreLabel(hidden)}
        </Button>
      )}
      {criteriaFor !== null && <SignalCriteriaDialog item={criteriaFor} table={table} onRetry={reload} onClose={() => setCriteriaFor(null)} />}
    </section>
  )
}

interface SignalFilterProps {
  items: TextEventItem[]
  signal: TextEventSignal | null
  onChange: (signal: TextEventSignal | null) => void
}

/** 신호 필터(3.42, AC29). 화면에서만 거르므로 풀면 서버가 정한 순서로 돌아간다. 건수가 0인 신호도 눌러 없다는 안내를 볼 수 있다 */
function SignalFilter({ items, signal, onChange }: SignalFilterProps) {
  return (
    <div className="text-events__filter" role="group" aria-label={SIGNAL_FILTER_LABEL}>
      {SIGNAL_FILTERS.map((option) => (
        <Chip key={option.label} pressed={signal === option.signal} count={signalFilterCount(items, option.signal)} onClick={() => onChange(option.signal)}>
          {option.label}
        </Chip>
      ))}
    </div>
  )
}

/** 후보였지만 어느 사건에도 들지 않은 변경의 건수(3.60, AC24·AC25). 변경 자체는 전체 변경에서 본다 */
function UnboundNote({ count }: { count: number }) {
  if (count === 0) return null
  return <p className="panel__note text-events__unbound">{unboundNote(count)}</p>
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
  const quoteList = (entries: TextEventQuote[]) =>
    entries.map((quote, index) => <QuoteBlock key={`${quote.evidenceId}-${index}`} quote={quote} onOpenEvidence={onOpenEvidence} />)
  // 사건 한 줄(3.58): 신호 · 제목 · 종류·규모·AI 생성 · 펼치기. 펼친 안쪽은 3.37~3.43의 내용 그대로이고 규모 금액의 근거 ID도 안쪽에 둔다
  return (
    <article className="text-event text-event--row" aria-label={item.title}>
      <div className="text-event__head">
        <Badge tone={signal.tone}>{signal.label}</Badge>
        <h4 className="text-event__title">{item.title}</h4>
        <span className="text-event__meta">{eventRowMeta(item)}</span>
        {/* 줄마다 같은 '펼치기'로 읽히지 않도록 이름에 사건 제목을 넣는다 */}
        <Button variant="secondary" aria-label={`${item.title} ${open ? '접기' : '펼치기'}`} aria-expanded={open} aria-controls={open ? bodyId : undefined} onClick={() => setOpen(!open)}>
          {open ? '접기' : '펼치기'}
        </Button>
      </div>
      {open && (
        <div id={bodyId} className="text-event__body">
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
          <FactsPart analysis={analysis} item={item} />
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
    </article>
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
