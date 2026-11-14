import { Fragment, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { match } from 'ts-pattern'
import type { Analysis } from '@/shared/api/analyses'
import type { TextChangeItem, TextField } from '@/shared/api/textChanges'
import type { TextEventItem, TextEventList, TextEventQuote, TextEventSignal } from '@/shared/api/textEvents'
import { Badge, Button, Chip, Mascot, Notice, Skeleton } from '@/shared/ui'
import { ErrorState, LoadingState } from '@/shared/ui/StateView'
import { displaySectionPath } from '@/shared/lib/sectionTitle'
import { useSignalTable, useTextEventDetail } from '../hooks/useTextEvents'
import { eventGlance, GLANCE_EVIDENCE, GLANCE_TITLE, termLinkLabel, termQuestion } from '../model/eventGlance'
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
  EVENTS_ORDER_NOTE,
  EVENTS_RETRY_LIMITED,
  EVENTS_TITLE,
  EVENTS_UNAVAILABLE,
  eventQuotes,
  eventRowMeta,
  eventScaleView,
  eventsMoreLabel,
  NO_QUOTE,
  NO_REASON,
  REASON_QUOTES_TITLE,
  SCALE_AMOUNT_LABEL,
  SCALE_CONVERTED_LABEL,
  unboundNote,
  visibleEvents,
  visibleUnbound,
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
  /** 한눈에 보기의 '○○이란?': AI 에이전트에게 그 용어를 묻는다 */
  onAsk: (question: string) => void
  /** 고른 분야. 유형·검색 등 다른 거르기는 사건에 걸지 않는다(3.61) */
  field: TextField | null
  /** 전체 변경을 유형·검색·위험 관련·고정으로 거르는 중인지. 들지 않은 후보 안내의 문구만 바뀐다 */
  listNarrowed: boolean
  onRetry: () => void
}

/** 탭 맨 위의 사건 자리(3.38, #826). 사건을 만드는 중이거나 만들지 못해도 탭의 나머지는 그대로 쓴다 */
export function TextEventsArea({ analysis, view, field, listNarrowed, onRetry, onAsk, onOpenEvidence, renderChanges }: TextEventsAreaProps) {
  return match(view)
    .with({ status: 'hidden' }, () => null)
    .with({ status: 'building' }, () => <LoadingState message={EVENTS_BUILDING} />)
    .with({ status: 'loading' }, () => <Skeleton label={EVENTS_LOADING} shape="card" count={1} />)
    .with({ status: 'unavailable' }, ({ retry }) => (
      <Notice tone="attention" role="status" className="text-events__notice">
        {/* 실패해도 다음에 갈 곳을 함께 알린다(#841) */}
        <div className="text-events__notice-body">
          <Mascot mood="none" size="sm" />
          <div>
            <p>
              {EVENTS_UNAVAILABLE}
              {retry === 'limited' && ` ${EVENTS_RETRY_LIMITED}`}
            </p>
            <p className="text-events__next">
              <Button variant="link" onClick={scrollToChangeList}>
                전체 변경 보기 ›
              </Button>
              <Link to={`/analyses/${analysis.analysisId}?tab=summary`}>요약 탭으로 가기 ›</Link>
            </p>
          </div>
        </div>
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
        <EventsGlance list={list} onOpenEvidence={onOpenEvidence} onAsk={onAsk} />
        <TextEventsSection analysis={analysis} list={list} items={visibleEvents(list.items, field)} onOpenEvidence={onOpenEvidence} renderChanges={renderChanges} />
        <UnboundNote count={visibleUnbound(list.unboundChanges, field).length} listNarrowed={listNarrowed} />
      </>
    ))
    .exhaustive()
}

/**
 * 한눈에 보기(#826). 코드가 센 사건·신호 건수 한 줄과, 서버 순서 앞 사건의 '공시의 의미' 첫 문장(AI 생성).
 * 문장 끝의 작은 '근거 ›'는 그 사건의 원문 비교를, '○○이란?'은 AI 에이전트에게 그 용어를 묻는다. 사건이 없으면 그리지 않는다
 */
function EventsGlance({ list, onOpenEvidence, onAsk }: { list: TextEventList; onOpenEvidence: (changeId: number) => void; onAsk: (question: string) => void }) {
  const glance = eventGlance(list)
  if (glance === null) return null
  return (
    <section className="event-glance" aria-labelledby="event-glance-title">
      <div className="event-glance__head">
        <h3 id="event-glance-title" className="event-glance__title">
          {GLANCE_TITLE}
        </h3>
        {glance.lines.length > 0 && <Badge tone="accent">AI 생성</Badge>}
      </div>
      <ol className="event-glance__list">
        <li>{glance.countLine}</li>
        {glance.lines.map((line) => (
          <li key={line.eventId}>
            {line.text}{' '}
            {line.changeId !== null && (
              <Button variant="link" className="event-glance__link" aria-haspopup="dialog" onClick={() => onOpenEvidence(line.changeId as number)}>
                {GLANCE_EVIDENCE}
              </Button>
            )}
            {line.terms.map((term, index) => (
              <Fragment key={term}>
                {(index > 0 || line.changeId !== null) && (
                  <span className="event-glance__dot" aria-hidden="true">
                    ·
                  </span>
                )}
                <Button variant="link" className="event-glance__link" aria-label={`${termLinkLabel(term)} AI 에이전트에게 묻기`} onClick={() => onAsk(termQuestion(term))}>
                  {termLinkLabel(term)}
                </Button>
              </Fragment>
            ))}
          </li>
        ))}
      </ol>
    </section>
  )
}

/**
 * 먼저 볼 변화(3.37 → #826). 순서는 서버가 정한 그대로(맨 앞 종류 → 금액 → 바뀐 단위 수)이고 그 순서에 번호를 붙인다.
 * 줄을 누르면 목록 대신 그 사건 하나를 자세히 보이고(공시의 의미 → 신호 이유 → 인용·사실·묶인 변경), 위 경로로 목록에 돌아온다.
 * 신호를 보여 주므로 기준표의 안내를 함께 둔다(ADR-0060). 기준표를 받지 못해도 '투자 판단이나 추천이 아니에요'는 남는다
 */
export function TextEventsSection({ analysis, list, items, onOpenEvidence, renderChanges }: TextEventsSectionProps) {
  const { state: table, reload } = useSignalTable()
  const [criteriaFor, setCriteriaFor] = useState<TextEventItem | null>(null)
  const [signal, setSignal] = useState<TextEventSignal | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [openId, setOpenId] = useState<number | null>(null)
  // 신호를 바꾸면 거른 사건도 처음 몇 건부터 다시 보인다
  const chooseSignal = (next: TextEventSignal | null) => {
    setSignal(next)
    setShowAll(false)
  }
  if (items.length === 0) return null
  const opened = items.find((item) => item.eventId === openId) ?? null
  if (opened !== null) {
    return (
      <section className="text-events" aria-label={`${EVENTS_TITLE}: ${opened.title}`}>
        <nav className="text-events__crumbs" aria-label="사건 위치">
          <Button variant="link" onClick={() => setOpenId(null)}>
            {EVENTS_TITLE}
          </Button>
          <span aria-hidden="true">›</span>
          <span aria-current="page">{opened.title}</span>
        </nav>
        <TextEventDetail analysis={analysis} item={opened} onOpenEvidence={onOpenEvidence} onOpenCriteria={() => setCriteriaFor(opened)} renderChanges={renderChanges} />
        <p className="panel__note">
          {EVENTS_NOTE}
          {table.status === 'success' && ` ${table.data.signalNotice}`}
        </p>
        {criteriaFor !== null && <SignalCriteriaDialog item={criteriaFor} table={table} onRetry={reload} onClose={() => setCriteriaFor(null)} />}
      </section>
    )
  }
  const filtered = eventsBySignal(items, signal)
  // 처음에는 몇 건만 보이고 나머지는 더 보기로 연다(3.58)
  const shown = showAll ? filtered : filtered.slice(0, EVENTS_INITIAL)
  const hidden = filtered.length - shown.length
  return (
    <section className="text-events" aria-labelledby="text-events-title">
      {/* 제목과 안내를 한 줄에(3.55 → 3.58) */}
      <div className="text-events__head">
        <h3 id="text-events-title" className="text-events__title">
          {EVENTS_TITLE} {resultCountLabel(filtered.length)} <span className="text-events__order">· {EVENTS_ORDER_NOTE}</span>
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
            <TextEventRow rank={items.indexOf(item) + 1} item={item} onOpen={() => setOpenId(item.eventId)} />
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

/** 후보였지만 어느 사건에도 들지 않은 변경의 건수(3.60, AC24·AC25). 누르면 그 변경이 있는 전체 변경 목록으로 옮긴다 */
function UnboundNote({ count, listNarrowed }: { count: number; listNarrowed: boolean }) {
  if (count === 0) return null
  return (
    <Button variant="link" className="text-events__unbound" onClick={scrollToChangeList}>
      <span>{unboundNote(count, listNarrowed)}</span>
      <span aria-hidden="true"> ›</span>
    </Button>
  )
}

/** 전체 변경 제목(TextTab의 text-list-title)으로 옮기고 초점을 준다 */
function scrollToChangeList() {
  const title = document.getElementById('text-list-title')
  title?.scrollIntoView({ block: 'start' })
  title?.focus({ preventScroll: true })
}

/** 먼저 볼 변화 한 줄: 번호 · 제목 · 신호와 종류·규모·AI 생성 · ›. 제목 버튼이 줄 전체를 덮어 어디를 눌러도 그 사건을 자세히 본다 */
function TextEventRow({ rank, item, onOpen }: { rank: number; item: TextEventItem; onOpen: () => void }) {
  const signal = signalBadge(item.signal)
  return (
    <article className="text-event-row" aria-label={item.title}>
      <span className="text-event-row__rank" aria-hidden="true">
        {rank}
      </span>
      <div className="text-event-row__body">
        <h4 className="text-event-row__title">
          <Button variant="link" className="text-event-row__open" aria-label={`${item.title} 자세히 보기`} onClick={onOpen}>
            {item.title}
          </Button>
        </h4>
        <div className="text-event-row__meta">
          <Badge tone={signal.tone}>{signal.label}</Badge>
          <span>{eventRowMeta(item)}</span>
        </div>
      </div>
      <span className="text-event-row__chevron" aria-hidden="true">
        ›
      </span>
    </article>
  )
}

type TextEventDetailProps = Omit<TextEventsSectionProps, 'list' | 'items'> & { item: TextEventItem; onOpenCriteria: () => void }

/** 사건 하나 자세히(#826). 무슨 일인지(공시의 의미)와 왜 이 신호인지를 먼저 두고, 그 아래에 규모·인용·사실·공시에 적힌 이유·묶인 변경 */
function TextEventDetail({ analysis, item, onOpenEvidence, onOpenCriteria, renderChanges }: TextEventDetailProps) {
  const [showChanges, setShowChanges] = useState(false)
  const changesId = `text-event-changes-${item.eventId}`
  const quotes = eventQuotes(item)
  const scale = eventScaleView(item)
  const signal = signalBadge(item.signal)
  const quoteList = (entries: TextEventQuote[]) =>
    entries.map((quote, index) => <QuoteBlock key={`${quote.evidenceId}-${index}`} quote={quote} onOpenEvidence={onOpenEvidence} />)
  return (
    <article className="text-event text-event--detail" aria-label={item.title}>
      <div className="text-event__head">
        <Badge tone={signal.tone}>{signal.label}</Badge>
        <h4 className="text-event__title">{item.title}</h4>
        <span className="text-event__meta">{eventRowMeta(item)}</span>
      </div>
      <div className="text-event__body">
        <MeaningPart item={item} onOpenEvidence={onOpenEvidence} />
        <SignalReasonPart item={item} onOpenEvidence={onOpenEvidence} onOpenCriteria={onOpenCriteria} />
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
    .with({ status: 'loading' }, () => <Skeleton label="묶인 변경을 불러오는 중이에요…" shape="card" count={2} />)
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
