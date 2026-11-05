import { ApiError } from '@/shared/api/client'
import type { TextField } from '@/shared/api/textChanges'
import type { TextEventItem, TextEventList, TextEventQuote, TextEventRun } from '@/shared/api/textEvents'
import type { PollingOptions } from '@/shared/hooks/pollingState'
import type { FieldCell } from './textFields'
import { resultCountLabel } from './textFilter'

/** 문장 변화 탭의 주요 사건(3.37) 화면 문구 */
export const EVENTS_TITLE = '주요 사건'
export const EVENTS_NOTE = 'AI가 변경을 사건으로 묶고 제목을 붙였어요. 인용은 원문 그대로예요. 투자 판단이나 추천이 아니에요.'
export const EVENTS_DROPPED_NOTE = '근거를 확인하지 못한 사건은 보여 주지 않았어요.'
export const CHANGE_QUOTES_TITLE = '바뀐 내용'
export const REASON_QUOTES_TITLE = '공시에 적힌 이유'
export const NO_REASON = '확인된 설명 없음'
export const NO_QUOTE = '이 쪽에서 인용한 글이 없어요.'

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

export type EventFieldCounts = ReadonlyMap<TextField, number>

/** 분야별 표에 넣을 칸별 사건 수. 응답에 없는 칸은 0건이다. 사건이 없으면(만들지 않음, 실패, 만드는 중) null이고 표에 그 줄이 빠진다 */
export function eventFieldCounts(list: TextEventList | null): EventFieldCounts | null {
  return list === null ? null : new Map(list.fieldCounts.map(({ field, eventCount }) => [field, eventCount]))
}

/** 칸의 '관련 주요 사건' 줄. 바뀐 내용이 없는 칸에는 두지 않는다 */
export function fieldEventLabel(cell: FieldCell, counts: EventFieldCounts | null): string | null {
  if (counts === null || cell.state !== 'changed') return null
  const count = counts.get(cell.field) ?? 0
  return count > 0 ? `관련 주요 사건 ${resultCountLabel(count)}` : '관련 주요 사건 없음'
}

export interface EventScope {
  pinned: boolean
  searched: boolean
  riskOnly: boolean
  type: unknown
  field: TextField | null
}

/** 지금 보여 줄 사건. 분야를 고르면 그 칸에 세어진 사건만 보이고, 고정·검색·유형·위험으로 거르면 찾는 변경이 앞에 오도록 사건 절을 뺀다 */
export function visibleEvents(items: TextEventItem[], { pinned, searched, riskOnly, type, field }: EventScope): TextEventItem[] {
  if (pinned || searched || riskOnly || type !== null) return []
  return field === null ? items : items.filter((item) => item.fields.includes(field))
}
