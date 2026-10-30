import { match } from 'ts-pattern'
import type { CompanyNote, NoteItem, NoteKind } from '@/shared/api/notes'
import { formatInteger } from '@/shared/lib/numberFormat'

/** 내 판단 노트 검색·유형·메모 거르기 순수 함수(#535, ST-2·ST-3) */

export type NoteKindFilter = 'ALL' | NoteKind

export interface NoteFilter {
  query: string
  kind: NoteKindFilter
  memoOnly: boolean
}

export const INITIAL_NOTE_FILTER: NoteFilter = {
  query: '',
  kind: 'ALL',
  memoOnly: false,
}

export type NoteFilterAction =
  | { type: 'set-query'; query: string }
  | { type: 'set-kind'; kind: NoteKindFilter }
  | { type: 'toggle-memo-only' }
  | { type: 'reset' }

export function noteFilterReducer(state: NoteFilter, action: NoteFilterAction): NoteFilter {
  return match<NoteFilterAction, NoteFilter>(action)
    .with({ type: 'set-query' }, ({ query }) => ({ ...state, query }))
    .with({ type: 'set-kind' }, ({ kind }) => ({ ...state, kind }))
    .with({ type: 'toggle-memo-only' }, () => ({ ...state, memoOnly: !state.memoOnly }))
    .with({ type: 'reset' }, () => INITIAL_NOTE_FILTER)
    .exhaustive()
}

export const NOTE_KIND_OPTIONS: readonly { value: NoteKindFilter; label: string }[] = [
  { value: 'ALL', label: '전체' },
  { value: 'FINANCIAL_CHANGE', label: '재무 수치' },
  { value: 'TEXT_CHANGE', label: '문장 변경' },
  { value: 'ANSWER_CITATION', label: 'AI 답 인용' },
]

export interface NoteCounts {
  total: number
  byKind: Record<NoteKind, number>
  memo: number
}

export function hasNoteMemo(item: Pick<NoteItem, 'memo'>): boolean {
  return item.memo !== null && item.memo.trim() !== ''
}

/** 전체 노트의 유형별·메모 보유 건수를 센다 */
export function countNotes(companies: readonly CompanyNote[]): NoteCounts {
  const byKind: Record<NoteKind, number> = {
    FINANCIAL_CHANGE: 0,
    TEXT_CHANGE: 0,
    ANSWER_CITATION: 0,
  }
  let total = 0
  let memo = 0
  for (const company of companies) {
    for (const item of company.items) {
      total += 1
      byKind[item.kind] += 1
      if (hasNoteMemo(item)) memo += 1
    }
  }
  return { total, byKind, memo }
}

export function isNoteFilterActive(filter: NoteFilter): boolean {
  return filter.query.trim() !== '' || filter.kind !== 'ALL' || filter.memoOnly
}

function matchesQuery(company: Pick<CompanyNote, 'corpCode' | 'corpName'>, item: NoteItem, normalizedQuery: string): boolean {
  if (normalizedQuery === '') return true
  const fields = [
    company.corpName,
    company.corpCode,
    item.label,
    item.text,
    item.question,
    item.memo,
    item.source.rceptNo,
  ]
  return fields.some((field) => field !== null && field.toLowerCase().includes(normalizedQuery))
}

function matchesItem(company: Pick<CompanyNote, 'corpCode' | 'corpName'>, item: NoteItem, filter: NoteFilter, normalizedQuery: string): boolean {
  if (filter.kind !== 'ALL' && item.kind !== filter.kind) return false
  if (filter.memoOnly && !hasNoteMemo(item)) return false
  return matchesQuery(company, item, normalizedQuery)
}

/** 조건에 맞는 항목만 남기고, 일치 항목이 0건인 기업은 뺀다 */
export function filterCompanyNotes(companies: readonly CompanyNote[], filter: NoteFilter): CompanyNote[] {
  if (!isNoteFilterActive(filter)) return [...companies]
  const normalizedQuery = filter.query.trim().toLowerCase()
  const result: CompanyNote[] = []
  for (const company of companies) {
    const items = company.items.filter((item) => matchesItem(company, item, filter, normalizedQuery))
    if (items.length > 0) {
      result.push({ ...company, items })
    }
  }
  return result
}

/** 필터 요약 문구: 기본은 전체 기업·건수, 필터 켜짐은 일치 기업·건수와 전체 건수 */
export function noteFilterSummary(
  totalCompanies: number,
  totalItems: number,
  filteredCompanies: readonly CompanyNote[],
  active: boolean,
): string {
  if (!active) {
    return `전체 ${formatInteger(totalCompanies)}개 기업 · ${formatInteger(totalItems)}건`
  }
  const matchedItems = filteredCompanies.reduce((sum, c) => sum + c.items.length, 0)
  return `일치 ${formatInteger(filteredCompanies.length)}개 기업 · ${formatInteger(matchedItems)}건 (전체 ${formatInteger(totalItems)}건)`
}
