import { match } from 'ts-pattern'
import type { ChangeType, TextChangeCounts, TextSectionCount } from '@/shared/api/textChanges'
import { displaySectionTitle } from '@/shared/lib/sectionTitle'

/** 문장 변화의 유형 거르기(#304)·섹션 거르기·검색(3.7). 검색어 길이는 docs/api-spec.md text-changes의 q와 같다. */

/** 유형 거르기. CONTENT는 '내용 변경'(추가·삭제·수정을 함께, 주소 ttype=CONTENT). null이면 전체 */
export type TextTypeFilter = ChangeType | 'CONTENT'

export const CONTENT_FILTER = 'CONTENT'
/** '내용 변경'에 드는 유형 */
export const CONTENT_TYPES: readonly ChangeType[] = ['ADDED', 'DELETED', 'MODIFIED']

/** 서버에 보낼 유형 목록. 비었으면 전체 */
export function apiTypesOf(filter: TextTypeFilter | null): readonly ChangeType[] {
  return match(filter)
    .with(null, () => [])
    .with(CONTENT_FILTER, () => CONTENT_TYPES)
    .with('ADDED', 'DELETED', 'MODIFIED', 'NUMERIC_UPDATE', 'MOVED', 'REVIEW_NEEDED', (type) => [type])
    .exhaustive()
}

/** '내용 변경' 건수(추가+삭제+수정). 응답 건수를 더한 표시용 합이다 */
export function contentCount(counts: TextChangeCounts): number {
  return counts.added + counts.deleted + counts.modified
}

/**
 * 이 분석에서 '내용 변경'이 '전체'와 다른지(숫자만 바뀜·위치 이동이 있는지).
 * 한 번이라도 있었으면 섹션·검색으로 0이 되어도 그대로 둔다(칩이 깜빡이지 않게). 아직 건수를 모르면 null
 */
export function nextContentAvailable(prev: boolean | null, counts: TextChangeCounts): boolean {
  return prev === true || counts.numericUpdate + counts.moved > 0
}

/** 실제로 쓸 유형 거르기. '내용 변경'이 없는 분석(이전 분석 등)에서 CONTENT는 전체로 본다. 건수를 모르면 그대로 둔다 */
export function resolveTypeFilter(filter: TextTypeFilter | null, contentAvailable: boolean | null): TextTypeFilter | null {
  return filter === CONTENT_FILTER && contentAvailable === false ? null : filter
}

export const SEARCH_MIN_LENGTH = 2
export const SEARCH_MAX_LENGTH = 100
/** 입력을 멈추고 이만큼 지나면 찾는다(ms) */
export const SEARCH_DEBOUNCE_MS = 300

/** 입력창 글의 상태. ready일 때만 서버에 보낸다 */
export type TextSearch = { kind: 'empty' } | { kind: 'too-short' } | { kind: 'ready'; q: string }

export function parseTextSearch(input: string): TextSearch {
  const q = input.trim().slice(0, SEARCH_MAX_LENGTH)
  if (q.length === 0) return { kind: 'empty' }
  if (q.length < SEARCH_MIN_LENGTH) return { kind: 'too-short' }
  return { kind: 'ready', q }
}

/** 서버에 보낼 검색어. 비었거나 짧으면 null(검색하지 않음) */
export function searchQueryOf(input: string): string | null {
  const search = parseTextSearch(input)
  return search.kind === 'ready' ? search.q : null
}

export const SEARCH_TOO_SHORT = `${SEARCH_MIN_LENGTH}자 이상 입력해 주세요.`
export const ALL_SECTIONS = ''

export interface SectionOption {
  /** 섹션 제목. 전체는 빈 글 */
  value: string
  label: string
}

/**
 * 섹션 선택지. 맨 앞은 전체이고, 주소에 남은 섹션이 목록에 없으면(다른 분석에서 옮겨 온 주소 등) 0건으로 붙여 고른 값을 그대로 보여 준다.
 */
export function sectionOptions(sections: TextSectionCount[], selected: string | null): SectionOption[] {
  const options = sections.map((s) => ({ value: s.title, label: `${displaySectionTitle(s.title)} (${formatCount(s.count)})` }))
  const missing = selected !== null && !sections.some((s) => s.title === selected)
  return [
    { value: ALL_SECTIONS, label: '전체 섹션' },
    ...options,
    ...(missing ? [{ value: selected, label: `${displaySectionTitle(selected)} (0)` }] : []),
  ]
}

/** 섹션이나 검색어로 거르고 있는지 */
export function hasSearchFilter(filter: { section: string | null; q: string | null }): boolean {
  return filter.section !== null || filter.q !== null
}

export function formatCount(n: number): string {
  return n.toLocaleString('ko-KR')
}

/** 거른 결과 건수 */
export function resultCountLabel(total: number): string {
  return `${formatCount(total)}건`
}

/** '더 보기'에 붙이는 남은 건수. 다 받았으면 null */
export function moreLabel(loaded: number, total: number): string | null {
  const remaining = total - loaded
  return remaining > 0 ? `더 보기 (남은 ${formatCount(remaining)}건)` : null
}
