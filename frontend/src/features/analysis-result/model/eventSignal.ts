import { match, P } from 'ts-pattern'
import type {
  SignalTable,
  SignalTableSignal,
  TextEventGlossaryTerm,
  TextEventHoldReason,
  TextEventItem,
  TextEventQuote,
  TextEventRowCounts,
  TextEventSentence,
  TextEventSentenceItem,
  TextEventSignal,
} from '@/shared/api/textEvents'
import { displaySectionPath } from '@/shared/lib/sectionTitle'
import { formatApproxPercent } from './format'
import { resultCountLabel } from './textFilter'

/** 사건 카드의 신호·사건 문장 칸(3.41, ADR-0060) 화면 문구 */
export const MEANING_TITLE = '공시의 의미'
export const GLOSSARY_TITLE = '용어 풀이'
export const SIGNAL_REASON_TITLE = '신호 이유'
export const JUDGMENT_LABEL = '판정'
export const FALLBACK_NOTE = '일반적인 설명이에요.'
export const CRITERIA_BUTTON = '기준 보기'
export const CRITERIA_TITLE = '신호 기준표'
export const CRITERIA_LOADING = '기준표를 불러오는 중이에요…'
export const CRITERIA_NOTE = '사건 종류와 변화로 신호가 정해져요. 금액의 크기는 신호를 바꾸지 않고 순서만 바꿔요.'
export const ABSENT_SCOPE_LABEL = '확인한 범위'
const NO_SCALE = '금액 알 수 없음'
const GOOD_LABEL = '좋은 면'
const BAD_LABEL = '나쁜 면'

export type SignalTone = 'attention' | 'positive' | 'neutral'

/** 신호 배지. 색만으로 나누지 않게 이름에 신호를 적는다 */
export function signalBadge(signal: TextEventSignal): { label: string; tone: SignalTone } {
  return match(signal)
    .with('CAUTION', () => ({ label: '주의 신호', tone: 'attention' }) as const)
    .with('POSITIVE', () => ({ label: '긍정 신호', tone: 'positive' }) as const)
    .with('HOLD', () => ({ label: '보류', tone: 'neutral' }) as const)
    .exhaustive()
}

/** AI가 기준표 목록 밖의 종류를 골랐을 때의 코드(docs/api-spec.md) */
const OTHER_KIND = 'OTHER'

/** 신호 필터(3.42, AC29)의 순서와 이름. null은 거르지 않음(전체) */
export const SIGNAL_FILTERS: readonly { signal: TextEventSignal | null; label: string }[] = [
  { signal: null, label: '전체' },
  { signal: 'CAUTION', label: '주의' },
  { signal: 'POSITIVE', label: '긍정' },
  { signal: 'HOLD', label: '보류' },
]
export const SIGNAL_FILTER_LABEL = '신호로 거르기'

/** 고른 신호의 사건만 서버가 정한 순서 그대로 남긴다. null이면 그대로 */
export function eventsBySignal<T extends Pick<TextEventItem, 'signal'>>(items: T[], signal: TextEventSignal | null): T[] {
  return signal === null ? items : items.filter((item) => item.signal === signal)
}

/** 필터 칩의 건수. 분야를 골랐으면 그 칸의 사건으로 세도록 지금 보이는 사건으로 센다(응답의 signalCounts는 전체 사건 기준) */
export function signalFilterCount(items: Pick<TextEventItem, 'signal'>[], signal: TextEventSignal | null): number {
  return eventsBySignal(items, signal).length
}

/** 고른 신호의 사건이 없을 때의 안내 */
export function signalEmptyText(signal: TextEventSignal): string {
  return `${signalBadge(signal).label}가 붙은 사건이 없어요.`
}

/** 사건 종류 배지. 기준표 목록에 있는 종류만 보이고, 목록 밖이면 배지 없이 둔다(AC9) */
export function kindBadge(item: Pick<TextEventItem, 'kind' | 'kindCode'>): string | null {
  return item.kindCode === OTHER_KIND ? null : item.kind
}

/** 보류 사유의 코드 문구(docs/api-spec.md) */
export function holdReasonText(reason: TextEventHoldReason): string {
  return match(reason)
    .with('NO_CRITERIA', () => '판단 기준이 아직 없는 사건이에요.')
    .with('EVIDENCE_NOT_CONFIRMED', () => '근거를 확인하지 못했어요.')
    .with('MIXED_SIDES', () => '좋은 면과 나쁜 면이 함께 있어요.')
    .with('MIXED_LITIGATION', () => '여러 소송의 진행 상황이 섞여 있어요.')
    .exhaustive()
}

function scaleLabel({ scaleRatio, scaleAmountText }: TextEventItem): string {
  if (scaleRatio !== null) return `자본총계의 ${formatApproxPercent(scaleRatio)}`
  return scaleAmountText ?? NO_SCALE
}

/** 판정 줄: AI가 고른 종류·변화와 코드가 잰 규모. 규모는 신호를 바꾸지 않는다 */
export function judgmentLine(item: TextEventItem): string {
  return [item.kind, item.changeName, scaleLabel(item)].filter((part) => part !== null).join(' · ')
}

export function rowCountsLabel({ changed, added, missing }: TextEventRowCounts): string {
  return `바뀐 행 ${resultCountLabel(changed)} · 새 행 ${resultCountLabel(added)} · 이번엔 없는 행 ${resultCountLabel(missing)}`
}

export interface SentenceSource {
  evidenceId: string
  /** 섹션 경로. 찾지 못하면 근거 ID */
  label: string
  /** 같은 블록을 인용한 변경. 있으면 원문 비교를 연다 */
  changeId: number | null
}

export interface SentenceLine {
  /** 좋은 면·나쁜 면. 그 밖에는 null */
  label: string | null
  text: string
  sources: SentenceSource[]
  /** '없음' 문장이라 위치가 확인한 범위인지 */
  scope: boolean
}

function sources(item: TextEventSentenceItem, quotes: TextEventQuote[]): SentenceSource[] {
  const ids = [...new Set(item.evidence.map((evidence) => evidence.evidenceId))]
  return ids.map((evidenceId) => {
    const sectionPath = item.evidence.find((evidence) => evidence.evidenceId === evidenceId)?.sectionPath ?? null
    return {
      evidenceId,
      label: sectionPath === null ? evidenceId : displaySectionPath(sectionPath),
      changeId: quotes.find((quote) => quote.evidenceId === evidenceId)?.changeId ?? null,
    }
  })
}

/** 좋은 면·나쁜 면 보류의 일반 문구는 좋은 면, 나쁜 면 순서로 온다 */
function generalLabel(index: number, holdReason: TextEventHoldReason | null): string | null {
  if (holdReason !== 'MIXED_SIDES') return null
  return index === 0 ? GOOD_LABEL : BAD_LABEL
}

function lineLabel(item: TextEventSentenceItem, index: number, holdReason: TextEventHoldReason | null): string | null {
  return match(item.type)
    .with('GOOD', () => GOOD_LABEL)
    .with('BAD', () => BAD_LABEL)
    .with('GENERAL', () => generalLabel(index, holdReason))
    .with(P.union('FACT', 'ABSENT', 'REASON', 'WHY_HOLD'), () => null)
    .exhaustive()
}

function lines(sentence: TextEventSentence, item: TextEventItem): SentenceLine[] {
  return sentence.items.map((entry, index) => ({
    label: lineLabel(entry, index, item.holdReason),
    text: entry.text,
    sources: sources(entry, item.quotes),
    scope: entry.type === 'ABSENT',
  }))
}

export interface MeaningView {
  /** AI 문장. 실패했으면 비어 있다 */
  lines: SentenceLine[]
  aiGenerated: boolean
  glossary: TextEventGlossaryTerm[]
}

/** 공시의 의미 칸. 실패하면 AI 문장을 빼고 용어 풀이만 남기며(AC16), 둘 다 없으면 칸이 없다(null) */
export function meaningView(item: TextEventItem): MeaningView | null {
  const generated = item.meaning?.status === 'GENERATED' ? item.meaning : null
  if (generated === null && item.glossary.length === 0) return null
  return { lines: generated === null ? [] : lines(generated, item), aiGenerated: generated !== null, glossary: item.glossary }
}

export interface SignalReasonView {
  /** 보류의 코드 문구. 보류가 아니면 null */
  firstLine: string | null
  /** 신호 이유를 만들지 않은 보류(기준 없음, 근거 미확인)면 null */
  judgment: string | null
  lines: SentenceLine[]
  aiGenerated: boolean
  /** 일반 문구로 대신했을 때만. 섞인 소송은 문구가 없어 붙이지 않는다 */
  fallbackNote: boolean
  /** 섞인 소송의 행 건수 */
  rowCounts: string | null
}

/** 신호 이유 칸(AC14, AC17~AC20) */
export function signalReasonView(item: TextEventItem): SignalReasonView {
  const firstLine = item.holdReason === null ? null : holdReasonText(item.holdReason)
  const reason = item.signalReason
  if (reason === null) return { firstLine, judgment: null, lines: [], aiGenerated: false, fallbackNote: false, rowCounts: null }
  const litigation = item.holdReason === 'MIXED_LITIGATION'
  return {
    firstLine,
    judgment: judgmentLine(item),
    lines: lines(reason, item),
    aiGenerated: reason.aiGenerated,
    fallbackNote: reason.status === 'FALLBACK' && !litigation,
    rowCounts: litigation && item.rowCounts !== null ? rowCountsLabel(item.rowCounts) : null,
  }
}

function tableSignalLabel(signal: SignalTableSignal | null): string {
  return match(signal)
    .with('CAUTION', () => signalBadge('CAUTION').label)
    .with('POSITIVE', () => signalBadge('POSITIVE').label)
    .with('MIXED', () => '보류 (좋은 면·나쁜 면)')
    .with(null, () => '보류 (기준 없음)')
    .exhaustive()
}

export interface CriteriaRow {
  key: string
  kind: string
  change: string
  signal: string
  /** 이 사건의 종류·변화인지 */
  current: boolean
}

/** '기준 보기'의 표. 종류·변화마다 한 줄 */
export function criteriaRows(table: SignalTable, event: Pick<TextEventItem, 'kindCode' | 'changeCode'>): CriteriaRow[] {
  return table.kinds.flatMap((kind) =>
    kind.changes.map((change) => ({
      key: `${kind.code}/${change.code}`,
      kind: kind.name,
      change: change.name,
      signal: tableSignalLabel(change.signal),
      current: kind.code === event.kindCode && change.code === event.changeCode,
    })),
  )
}
