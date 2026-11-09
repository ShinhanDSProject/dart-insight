import { match, P } from 'ts-pattern'
import { ApiError } from '@/shared/api/client'
import type { TextField } from '@/shared/api/textChanges'
import type { TextEventItem, TextEventList, TextEventNotCreatedReason, TextEventQuote, TextEventRun, TextEventUnboundChange } from '@/shared/api/textEvents'
import type { AsyncState } from '@/shared/hooks/asyncState'
import type { PollingOptions, PollingState } from '@/shared/hooks/pollingState'
import { formatApproxWon } from './format'
import type { FieldCell } from './textFields'
import { kindBadge } from './eventSignal'
import { formatCount, resultCountLabel } from './textFilter'

/** 문장 변화 탭의 주요 사건(3.37, 3.38) 화면 문구 */
export const EVENTS_TITLE = '주요 사건'
export const EVENTS_NOTE = 'AI가 변경을 사건으로 묶고 제목을 붙였어요. 인용은 원문 그대로예요. 투자 판단이나 추천이 아니에요.'
export const EVENTS_DROPPED_NOTE = '근거를 확인하지 못한 사건은 보여 주지 않았어요.'
export const CHANGE_QUOTES_TITLE = '바뀐 내용'
export const REASON_QUOTES_TITLE = '공시에 적힌 이유'
export const NO_REASON = '확인된 설명 없음'
export const NO_QUOTE = '이 쪽에서 인용한 글이 없어요.'
export const EVENTS_BUILDING = '주요 사건을 만드는 중이에요. 분야별 표와 전체 변경은 먼저 볼 수 있어요.'
export const EVENTS_LOADING = '주요 사건을 불러오는 중이에요…'
export const EVENTS_UNAVAILABLE = '주요 사건을 만들지 못했어요. 분야별 표와 전체 변경은 그대로 볼 수 있어요.'
export const EVENTS_RETRY_LIMITED = '여러 번 실패해 지금은 다시 시도할 수 없어요. 나중에 다시 확인해 주세요.'
export const EVENTS_EMPTY = '이번 비교에는 주요 사건으로 묶은 변경이 없어요. 분야별 표와 전체 변경은 그대로 볼 수 있어요.'
export const UNBOUND_TITLE = '사건으로 묶이지 않은 주요 변경'
export const UNBOUND_NOTE = '주요 변경 후보로 꼽혔지만 어느 사건에도 들어가지 않은 변경이에요. 공시 글을 그대로 보여 드려요.'
export const SCALE_AMOUNT_LABEL = '금액'
export const SCALE_CONVERTED_LABEL = '원화 환산 참고'

/** 묶인 변경을 한 번에 보이는 건수. 사건 API는 쪽을 나누지 않아 화면에서 나눈다 */
export const EVENT_CHANGES_PAGE_SIZE = 10

const RUN_POLL_INTERVAL_MS = 3000
const MAX_RUN_POLL_FAILURES = 5

/** 사건 작업 상태 조회. 만드는 중일 때만 다시 묻는다 */
export const eventRunPolling: PollingOptions<TextEventRun> = {
  shouldContinue: (run) => run.status === 'PENDING' || run.status === 'RUNNING',
  isFatal: (error) => error instanceof ApiError && error.status >= 400 && error.status < 500,
  maxFailures: MAX_RUN_POLL_FAILURES,
  delay: (failures) => Math.min(RUN_POLL_INTERVAL_MS * 2 ** failures, 30_000),
}

/**
 * 탭을 열 때 만들기를 시작할지. 실행이 없을 때와, fake 모델이라 만들지 않았던 때(진짜 모델로 바꾸면 새로 만들 수 있다)만 시작한다.
 * 실패한 실행은 자동으로 다시 시작하지 않는다(ADR-0050).
 */
export function needsEventStart(run: TextEventRun): boolean {
  return run.status === 'NOT_STARTED' || (run.status === 'NOT_CREATED' && run.notCreatedReason === 'FAKE_MODEL')
}

/**
 * 사건 자리에 무엇을 보일지.
 * hidden 자리 없음(상태 확인 중, 꺼 둠, 옛 분석, 문장 비교 실패) / building 만드는 중 / loading 다 만든 사건을 받는 중 /
 * unavailable 만들지 못함(실패, fake 모델, 조회 실패) / empty 묶은 사건 없음 / ready 받은 사건
 * retry는 available 다시 시도할 수 있음 / limited 실패 횟수 한도에 닿음 / none 다시 시도해도 같음(fake 모델)
 */
export type TextEventsView =
  | { status: 'hidden' | 'building' | 'loading' | 'empty' }
  | { status: 'unavailable'; retry: 'available' | 'limited' | 'none' }
  | { status: 'ready'; list: TextEventList }

function notCreatedView(reason: TextEventNotCreatedReason | null): TextEventsView {
  return match(reason)
    .with('FAKE_MODEL', () => ({ status: 'unavailable', retry: 'none' }) as const)
    .with('NO_CANDIDATES', () => ({ status: 'empty' }) as const)
    .with(P.union('DISABLED', 'OLD_ANALYSIS', 'TEXT_COMPARE_FAILED', null), () => ({ status: 'hidden' }) as const)
    .exhaustive()
}

function completedView(events: AsyncState<TextEventList>): TextEventsView {
  return match<AsyncState<TextEventList>, TextEventsView>(events)
    .with({ status: P.union('idle', 'loading') }, () => ({ status: 'loading' }))
    .with({ status: 'error' }, () => ({ status: 'unavailable', retry: 'available' }))
    .with({ status: 'success' }, ({ data }) => (data.items.length === 0 && data.unboundChanges.length === 0 ? { status: 'empty' } : { status: 'ready', list: data }))
    .exhaustive()
}

/** 작업 상태와 받은 사건으로 사건 자리를 정한다. 조회가 실패해 알 수 없으면 만들지 못한 것으로 보이고, 사건이 있는 것처럼 보이지 않는다 */
export function textEventsView(run: PollingState<TextEventRun>, events: AsyncState<TextEventList>): TextEventsView {
  return match<PollingState<TextEventRun>, TextEventsView>(run)
    .with({ status: 'loading' }, () => ({ status: 'hidden' }))
    .with({ status: 'error' }, () => ({ status: 'unavailable', retry: 'available' }))
    .with({ status: 'success' }, ({ data }) =>
      match<TextEventRun['status'], TextEventsView>(data.status)
        .with(P.union('PENDING', 'RUNNING'), () => ({ status: 'building' }))
        .with('FAILED', () => ({ status: 'unavailable', retry: data.canRetry ? 'available' : 'limited' }))
        .with('NOT_STARTED', () => ({ status: 'hidden' }))
        .with('NOT_CREATED', () => notCreatedView(data.notCreatedReason))
        .with('COMPLETED', () => completedView(events))
        .exhaustive(),
    )
    .exhaustive()
}

/** 받은 사건 목록. 받지 못했으면 null */
export function eventListOf(view: TextEventsView): TextEventList | null {
  return view.status === 'ready' ? view.list : null
}

export interface EventQuotes {
  previous: TextEventQuote[]
  current: TextEventQuote[]
  reasons: TextEventQuote[]
}

/** 인용을 칸별로 나눈다. 바뀐 내용은 이전·이번으로 나누고, 이유는 어느 쪽이든 한 칸에 둔다 */
export function eventQuotes(item: TextEventItem): EventQuotes {
  const changes = item.quotes.filter((quote) => quote.purpose === 'CHANGE')
  return {
    previous: changes.filter((quote) => quote.side === 'PREVIOUS'),
    current: changes.filter((quote) => quote.side === 'CURRENT'),
    reasons: item.quotes.filter((quote) => quote.purpose === 'REASON'),
  }
}

export interface EventScaleView {
  /** 원래 통화의 금액. 원문 표기 그대로 */
  amount: string
  /** 외화의 원화 환산 참고값과 기준. 원화이거나 기준을 밝힐 수 없으면 null */
  converted: string | null
  evidenceId: string | null
}

function convertedLabel({ scaleAmountKrw, fxSource, fxRateDate }: TextEventItem): string | null {
  if (scaleAmountKrw === null) return null
  const approx = formatApproxWon(scaleAmountKrw)
  return match(fxSource)
    .with('disclosed_rate', () => `${approx} (기준: 이 공시에 적힌 환율)`)
    .with('reference_table', () => (fxRateDate === null ? null : `${approx} (기준: 한국은행 매매기준율 ${fxRateDate})`))
    .with(P.union('none', null), () => null)
    .exhaustive()
}

/** 사건 카드의 금액 줄(ADR-0053). 금액을 모르면 null이고 줄이 없다. 사건끼리 더하지 않는다 */
export function eventScaleView(item: TextEventItem): EventScaleView | null {
  if (item.scaleAmount === null || item.scaleAmountText === null) return null
  return { amount: item.scaleAmountText, converted: convertedLabel(item), evidenceId: item.scaleEvidenceId }
}

export type EventFieldCounts = ReadonlyMap<TextField, number>

/** 분야별 표에 넣을 칸별 사건 수. 응답에 없는 칸은 0건이다. 사건이 없으면(만들지 않음, 실패, 만드는 중) null이고 표에 그 줄이 빠진다 */
export function eventFieldCounts(list: TextEventList | null): EventFieldCounts | null {
  return list === null ? null : new Map(list.fieldCounts.map(({ field, eventCount }) => [field, eventCount]))
}

/** 분야 칩 뒤에 붙는 '사건 n'(3.58). 사건이 있는 칸에만 붙인다 */
export function fieldEventLabel(cell: FieldCell, counts: EventFieldCounts | null): string | null {
  if (counts === null || cell.state !== 'changed') return null
  const count = counts.get(cell.field) ?? 0
  return count > 0 ? `사건 ${formatCount(count)}` : null
}

/** 처음에 보이는 사건 수(3.58). 나머지는 '사건 n건 더 보기'로 연다 */
export const EVENTS_INITIAL = 3

export function eventsMoreLabel(hidden: number): string {
  return `사건 ${resultCountLabel(hidden)} 더 보기`
}

/** 사건 한 줄의 덧붙임: 종류 · 규모 · AI 생성(3.58). 목록 밖 종류와 규모가 없으면 뺀다 */
export function eventRowMeta(item: TextEventItem): string {
  const kind = kindBadge(item)
  const scale = eventScaleView(item)
  return [kind, scale?.amount ?? null, 'AI 생성'].filter((part): part is string => part !== null).join(' · ')
}

export interface EventScope {
  pinned: boolean
  searched: boolean
  riskOnly: boolean
  type: unknown
  field: TextField | null
}

/** 고정·검색·유형·위험으로 거르는 중인지. 이때는 찾는 변경이 앞에 오도록 사건 자리를 통째로 뺀다 */
export function eventsNarrowed({ pinned, searched, riskOnly, type }: EventScope): boolean {
  return pinned || searched || riskOnly || type !== null
}

/** 지금 보여 줄 사건. 분야를 고르면 그 칸에 세어진 사건만 보인다 */
export function visibleEvents(items: TextEventItem[], scope: EventScope): TextEventItem[] {
  const { field } = scope
  if (eventsNarrowed(scope)) return []
  return field === null ? items : items.filter((item) => item.fields.includes(field))
}

/** 지금 보여 줄 묶이지 않은 변경. 분야를 고르면 그 칸의 변경만 보인다 */
export function visibleUnbound(changes: TextEventUnboundChange[], scope: EventScope): TextEventUnboundChange[] {
  if (eventsNarrowed(scope)) return []
  return scope.field === null ? changes : changes.filter((change) => change.field === scope.field)
}
