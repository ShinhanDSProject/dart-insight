import { match, P } from 'ts-pattern'
import type { NoteScope, TextField, TextListGroup } from '@/shared/api/textChanges'
import { resultCountLabel } from './textFilter'
import type { TextTypeFilter } from './textFilter'

/** 문장 변화 탭의 기본 목록과 접힌 묶음(3.29). 묶음의 뜻은 docs/api-spec.md text-changes의 listGroup 표와 같다. */
const DEFAULT_LIST_GROUPS: TextListGroup[] = ['MAIN', 'UNPAIRED']

export const FOLDED_TITLE = '접어 둔 변경'
export const LIST_TITLE = '전체 변경'
export const FOLDED_NOTE = '기본 목록에서 접었을 뿐 지우지 않았어요. 검색하거나 유형·섹션으로 거르면 함께 찾아요.'
export const DEFAULT_LIST_EMPTY = '기본 목록에 보일 변경이 없어요.'
export const DEFAULT_LIST_EMPTY_NOTE = '아래 접어 둔 변경을 펼치면 볼 수 있어요.'

export interface ListFilter {
  type: TextTypeFilter | null
  section: string | null
  q: string | null
  risk: boolean
  field: TextField | null
}

/** 아무것도 거르지 않은 기본 보기인지 */
export function isDefaultList({ type, section, q, risk, field }: ListFilter): boolean {
  return type === null && section === null && q === null && !risk && field === null
}

/**
 * 목록 요청에 보낼 묶음. 거르면 묶음을 보내지 않아 접힌 변경도 찾고, 칩·섹션·위험 카드의 건수와도 맞는다(AC6).
 * 분야는 서버가 기본 목록에서만 거른다.
 */
export function listGroupsOf(filter: ListFilter): TextListGroup[] {
  return isDefaultList(filter) ? DEFAULT_LIST_GROUPS : []
}

const FOLDED_GROUPS: { group: TextListGroup; label: string; description: string }[] = [
  { group: 'NOTE', label: '재무제표 주석', description: '소송·담보 등으로 올린 것을 뺀 나머지 주석이에요. 연결 주석을 먼저, 별도 주석을 뒤에 보여 줘요.' },
  { group: 'HEADING', label: '제목 줄처럼 짧은 글', description: '20자 미만으로 추가되거나 삭제된 글이에요.' },
  { group: 'FORMATTING', label: '띄어쓰기·기호만 다른 수정', description: '글자는 같고 띄어쓰기나 문장부호만 달라요.' },
  {
    group: 'PERIOD',
    label: '기수·기준일만 바뀐 글',
    description: '기수나 연도·기준일이 보고서 기간만큼만 바뀌고 나머지 글은 같아요.',
  },
  { group: 'MOVED', label: '자리만 옮긴 글', description: '내용은 같고 위치만 바뀌었어요.' },
  { group: 'PAIRED_TABLE', label: '표 구성이 바뀌어 짝지은 이전 표', description: '새로 생긴 표와 짝지어 행끼리 비교한 이전 표예요.' },
]

export type GroupCounts = Record<TextListGroup, number>

export interface FoldedGroup {
  group: TextListGroup
  label: string
  description: string
  count: number
}

/** 접힌 묶음. 0건인 묶음은 뺀다 */
export function foldedGroups(counts: GroupCounts): FoldedGroup[] {
  return FOLDED_GROUPS.map((entry) => ({ ...entry, count: counts[entry.group] })).filter((entry) => entry.count > 0)
}

export function foldedTotal(counts: GroupCounts): number {
  return foldedGroups(counts).reduce((sum, entry) => sum + entry.count, 0)
}

/** 분석의 모든 변경 수. 묶음이 모든 변경을 나누므로 묶음 건수를 더한다 */
export function allChangesTotal(counts: GroupCounts): number {
  return Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0)
}

/**
 * '전체 변경' 제목 옆의 건수 안내(3.59). 'N건 중 먼저 볼 M건'에서 N은 모든 변경, M은 기본 목록이다.
 * 짝을 정하지 못한 항목은 목록에 함께 보이지만 건수는 따로 알린다(AC9)
 */
export function defaultListNote(counts: GroupCounts, grouped: boolean): string {
  const main = `${resultCountLabel(allChangesTotal(counts))} 중 먼저 볼 ${resultCountLabel(counts.MAIN)}${grouped ? ' · 목차 순서로 묶었어요' : ''}`
  if (counts.UNPAIRED === 0) return main
  return `${main} · 짝을 정하지 못한 항목 ${resultCountLabel(counts.UNPAIRED)}(분야와 기본 목록 건수에는 세지 않아요)`
}

export interface ListHeadState {
  /** 고정한 변경만 보는지 */
  pinned: boolean
  /** 아무것도 거르지 않은 기본 보기인지 */
  defaultList: boolean
  /** 검색·위험 관련·분야로 걸렀는지(유형은 칩에 건수가 있어 따로 알리지 않는다) */
  narrowed: boolean
  groupCounts: GroupCounts | null
  /** 받은 목록의 전체 건수. 아직 모르거나 0건이면 null */
  total: number | null
  /** 목차 머리줄로 묶어 보이는지(문서 순서) */
  grouped: boolean
}

/** '전체 변경' 제목 옆 한 줄(3.59). 기본 목록이면 묶음 건수, 거르면 결과 건수, 그 밖에는 없다 */
export function listHeadNote({ pinned, defaultList, narrowed, groupCounts, total, grouped }: ListHeadState): string | null {
  return match({ pinned, defaultList, narrowed, groupCounts, total })
    .with({ pinned: true }, () => null)
    .with({ defaultList: true, groupCounts: P.nonNullable }, ({ groupCounts: counts }) => defaultListNote(counts, grouped))
    .with({ narrowed: true, total: P.number }, ({ total: count }) => `조건에 맞는 변경 ${resultCountLabel(count)}`)
    .otherwise(() => null)
}

/** 주석 카드에 붙이는 이름. 구분할 수 없거나 주석이 아니면 null */
export function noteScopeLabel(scope: NoteScope | null): string | null {
  return match(scope)
    .with('CONSOLIDATED', () => '연결 주석')
    .with('SEPARATE', () => '별도 주석')
    .with('UNKNOWN', null, () => null)
    .exhaustive()
}
