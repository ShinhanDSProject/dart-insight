import { match, P } from 'ts-pattern'
import { dartViewerUrl } from '@/shared/lib/dart'
import type {
  Dividend,
  KeyFactChange,
  KeyFactChangeType,
  KeyFactSection,
  MajorShareholder,
} from '@/shared/api/keyFacts'

/**
 * 최대주주·임원·배당 변화(#331)의 화면용 순수 함수. 값은 원문 문자열을 그대로 옮기고 계산하지 않는다.
 * 바뀐 항목(changes)은 backend가 짝지어 주고, 여기서는 한 줄 문장만 만든다.
 */

export type KeyFactGroupKind = 'majorShareholders' | 'executives' | 'dividends'

export const groupTitles: Record<KeyFactGroupKind, string> = {
  majorShareholders: '최대주주 현황',
  executives: '임원 현황',
  dividends: '배당에 관한 사항',
}

/** 한 보고서 묶음의 화면 상태 */
export type SectionView<T> =
  | { kind: 'no-report' }
  | { kind: 'no-data' }
  | { kind: 'unavailable' }
  | { kind: 'available'; rows: T[]; settlementDate: string | null; correctedSource: CorrectedSource | null }

/** 값을 이 보고서가 아니라 뒤에 나온 정정 공시에서 받았을 때 그 공시(#350, FS-46의 '정정 공시 값'과 같음) */
export interface CorrectedSource {
  rceptNo: string
  /** 접수번호가 14자리가 아니면 null(링크를 만들지 않음) */
  dartUrl: string | null
}

export function correctedSource(section: Pick<KeyFactSection<unknown>, 'rceptNo' | 'sourceRceptNo'>): CorrectedSource | null {
  const source = section.sourceRceptNo
  return source === null || source === section.rceptNo ? null : { rceptNo: source, dartUrl: dartViewerUrl(source) }
}

export function sectionView<T>(section: KeyFactSection<T> | null): SectionView<T> {
  return match(section)
    .with(null, () => ({ kind: 'no-report' }) as const)
    .with({ status: 'NO_DATA' }, () => ({ kind: 'no-data' }) as const)
    .with({ status: 'UNAVAILABLE' }, () => ({ kind: 'unavailable' }) as const)
    .with(
      { status: 'AVAILABLE' },
      (s) =>
        ({
          kind: 'available',
          rows: s.rows,
          settlementDate: s.settlementDate,
          correctedSource: correctedSource(s),
        }) as const,
    )
    .exhaustive()
}

/** 바뀐 종류 표식. 색만으로 구분하지 않도록 기호와 글자를 함께 쓴다(UI-5) */
export function changeMark(type: KeyFactChangeType): { symbol: string; label: string } {
  return match(type)
    .with('ADDED', () => ({ symbol: '+', label: '추가' }))
    .with('REMOVED', () => ({ symbol: '−', label: '빠짐' }))
    .with('CHANGED', () => ({ symbol: '→', label: '바뀜' }))
    .exhaustive()
}

const EMPTY = '없음'

function value(text: string | null, unit = ''): string {
  return text === null ? EMPTY : `${text}${unit}`
}

function withKind(name: string, stockKind: string | null): string {
  return stockKind === null ? name : `${name}(${stockKind})`
}

/** 바뀐 항목 한 줄. 예: '이재용(보통주) 지분 1.65% → 1.67%', '새 임원: 김용관(사장)' */
export function changeLine(kind: KeyFactGroupKind, change: KeyFactChange): string {
  return match(kind)
    .with('majorShareholders', () => shareholderLine(change))
    .with('executives', () => executiveLine(change))
    .with('dividends', () => dividendLine(change))
    .exhaustive()
}

function shareholderLine(change: KeyFactChange): string {
  const who = withKind(change.name, change.stockKind)
  return match(change)
    .with({ type: 'ADDED' }, (c) => `${who} 새로 포함 · 지분 ${value(c.after, '%')}`)
    .with({ type: 'REMOVED' }, (c) => `${who} 목록에서 빠짐 · 이전 지분 ${value(c.before, '%')}`)
    .with({ type: 'CHANGED', field: 'endShares' }, (c) => `${who} 주식 수 ${value(c.before, '주')} → ${value(c.after, '주')}`)
    .with({ type: 'CHANGED' }, (c) => `${who} 지분 ${value(c.before, '%')} → ${value(c.after, '%')}`)
    .exhaustive()
}

function executiveLine(change: KeyFactChange): string {
  const titled = (position: string | null) => (position === null ? change.name : `${change.name}(${position})`)
  return match(change)
    .with({ type: 'ADDED' }, (c) => `새 임원: ${titled(c.after)}`)
    .with({ type: 'REMOVED' }, (c) => `빠진 임원: ${titled(c.before)}`)
    .with({ type: 'CHANGED', field: 'registeredType' }, (c) => `${c.name} 등기 구분 ${value(c.before)} → ${value(c.after)}`)
    .with({ type: 'CHANGED' }, (c) => `${c.name} 직위 ${value(c.before)} → ${value(c.after)}`)
    .exhaustive()
}

function dividendLine(change: KeyFactChange): string {
  const what = withKind(change.name, change.stockKind)
  return match(change)
    .with({ type: 'ADDED' }, (c) => `${what} 새로 공시 · ${value(c.after)}`)
    .with({ type: 'REMOVED' }, (c) => `${what} 공시에서 빠짐 · 이전 ${value(c.before)}`)
    .with({ type: 'CHANGED' }, (c) => `${what} ${value(c.before)} → ${value(c.after)}`)
    .exhaustive()
}

/** 두 보고서를 한 표에 놓는 행. 값은 원문 그대로, 한쪽에만 있으면 다른 쪽은 null */
export interface PairedRow {
  key: string
  name: string
  stockKind: string | null
  before: string | null
  after: string | null
  /** 이전·현재 값이 다른지(문자열 비교) */
  changed: boolean
}

/** 행을 이름 + 주식 종류로 짝지어 현재 보고서 순서, 그다음 이전 보고서에만 있는 행 순서로 놓는다 */
function pairRows<T>(
  previous: T[],
  current: T[],
  name: (row: T) => string | null,
  stockKind: (row: T) => string | null,
  pick: (row: T) => string | null,
): PairedRow[] {
  const keyOf = (row: T) => `${name(row) ?? ''}\u0000${stockKind(row) ?? ''}`
  const before = new Map<string, T>()
  for (const row of previous) if (!before.has(keyOf(row))) before.set(keyOf(row), row)
  const seen = new Set<string>()
  const rows: PairedRow[] = []
  const push = (row: T, beforeValue: string | null, afterValue: string | null) => {
    rows.push({
      key: keyOf(row),
      name: name(row) ?? EMPTY,
      stockKind: stockKind(row),
      before: beforeValue,
      after: afterValue,
      changed: beforeValue !== afterValue,
    })
  }
  for (const row of current) {
    const key = keyOf(row)
    if (seen.has(key)) continue
    seen.add(key)
    const old = before.get(key)
    push(row, old === undefined ? null : pick(old), pick(row))
  }
  for (const [key, row] of before) {
    if (!seen.has(key)) push(row, pick(row), null)
  }
  return rows
}

/** 최대주주: 기말 지분율(%)을 나란히 */
export function pairShareholders(previous: MajorShareholder[], current: MajorShareholder[]): PairedRow[] {
  return pairRows(previous, current, (r) => r.name, (r) => r.stockKind, (r) => r.endRatio)
}

/** 배당: 각 보고서의 당기 값을 나란히 */
export function pairDividends(previous: Dividend[], current: Dividend[]): PairedRow[] {
  return pairRows(previous, current, (r) => r.category, (r) => r.stockKind, (r) => r.currentTerm)
}

/** 한 쪽 묶음만 있을 때(이전 보고서 없음 등) 행 목록 */
export function rowsOf<T>(view: SectionView<T>): T[] {
  return match(view)
    .with({ kind: 'available' }, (v) => v.rows)
    .with({ kind: P.union('no-report', 'no-data', 'unavailable') }, () => [])
    .exhaustive()
}

/** 표를 처음부터 다 펼치지 않는 행 수. 넘으면 바뀐 항목만 먼저 보이고 '전체 보기'로 펼친다 */
export const COLLAPSE_AFTER = 8
