import { match } from 'ts-pattern'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import type { PostQuote, QuoteKind, QuoteRequest } from '@/shared/api/community'
import type { FinancialChangeItem, StatementSummary } from '@/shared/api/results'
import type { TextChangeItem } from '@/shared/api/textChanges'
import { formatInteger } from '@/shared/lib/numberFormat'
import type { SegmentOption } from '@/shared/ui'

/** 글에 붙이는 변경점(#464, FS-58). 카드는 backend가 만든 사본을 보이고, 고르는 동안만 화면이 미리보기를 만든다 */

export const quoteKindOptions: readonly SegmentOption<QuoteKind>[] = [
  { value: 'TEXT_CHANGE', label: '문장 변경' },
  { value: 'FINANCIAL_CHANGE', label: '재무 계정' },
]

const changeTypeLabels: Record<string, string> = {
  ADDED: '추가',
  DELETED: '삭제',
  MODIFIED: '수정',
  NUMERIC_UPDATE: '숫자만 바뀜',
  MOVED: '위치 이동',
  REVIEW_NEEDED: '검토 필요',
}

/** 카드 배지: '문장 변경 · 수정', '재무 계정' */
export function quoteKindLabel(quote: Pick<PostQuote, 'kind' | 'changeType'>): string {
  return match(quote.kind)
    .with('FINANCIAL_CHANGE', () => '재무 계정')
    .with('TEXT_CHANGE', () => {
      const type = quote.changeType === null ? undefined : changeTypeLabels[quote.changeType]
      return type === undefined ? '문장 변경' : `문장 변경 · ${type}`
    })
    .exhaustive()
}

/** 카드를 누르면 가는 결과 화면의 그 변경. 결과 화면 주소 약속(?tab=financial&sj=&change=, ?tab=text&tc=)과 같다 */
export function quoteLink(quote: Pick<PostQuote, 'kind' | 'sjDiv' | 'source'>): string {
  const base = `/analyses/${encodeURIComponent(quote.source.analysisId)}`
  const changeId = String(quote.source.changeId)
  return match(quote.kind)
    .with('FINANCIAL_CHANGE', () =>
      quote.sjDiv === null
        ? `${base}?${new URLSearchParams({ tab: 'financial', change: changeId })}`
        : `${base}?${new URLSearchParams({ tab: 'financial', sj: quote.sjDiv, change: changeId })}`,
    )
    .with('TEXT_CHANGE', () => `${base}?${new URLSearchParams({ tab: 'text', tc: changeId })}`)
    .exhaustive()
}

export function reportPairLabel(pair: PostQuote['reportPair']): string {
  return `${pair.previous} → ${pair.current}`
}

/** 고른 변경점. request만 서버에 보내고, 나머지는 올리기 전 미리보기다 */
export interface QuotePick {
  request: QuoteRequest
  kindLabel: string
  label: string
  text: string
  reportPair: PostQuote['reportPair']
}

function pair(analysis: CompanyAnalysisItem): PostQuote['reportPair'] {
  return { previous: analysis.previous.reportName, current: analysis.current.reportName }
}

export function textPick(analysis: CompanyAnalysisItem, item: TextChangeItem): QuotePick {
  return {
    request: { kind: 'TEXT_CHANGE', analysisId: analysis.analysisId, changeId: item.changeId },
    kindLabel: quoteKindLabel({ kind: 'TEXT_CHANGE', changeType: item.changeType }),
    label: item.sectionPath,
    text: item.currentPreview ?? item.previousPreview ?? item.reviewReason ?? '',
    reportPair: pair(analysis),
  }
}

export function financialPick(analysis: CompanyAnalysisItem, statement: string, item: FinancialChangeItem): QuotePick {
  return {
    request: { kind: 'FINANCIAL_CHANGE', analysisId: analysis.analysisId, changeId: item.changeId },
    kindLabel: '재무 계정',
    label: `${statement} · ${accountName(item)}`,
    text: amountChangeLabel(item),
    reportPair: pair(analysis),
  }
}

export function accountName(item: Pick<FinancialChangeItem, 'accountName' | 'accountDetail'>): string {
  return item.accountDetail === null ? item.accountName : `${item.accountName} · ${item.accountDetail}`
}

/** 이전 → 현재 값. 없는 값은 0이 아니라 '없음'(API 규칙: null과 0을 나눔) */
export function amountChangeLabel(item: Pick<FinancialChangeItem, 'previousAmount' | 'currentAmount'>): string {
  const value = (amount: number | null) => (amount === null ? '없음' : formatInteger(amount))
  return `이전 ${value(item.previousAmount)} → 현재 ${value(item.currentAmount)}`
}

/** 고를 수 있는 재무제표(비교할 수 있고 바뀐 계정이 있는 것). 이름은 서버가 준 label */
export function statementOptions(statements: readonly StatementSummary[]): SegmentOption<StatementSummary['sjDiv']>[] {
  return statements.filter((s) => s.comparable && s.changed > 0).map((s) => ({ value: s.sjDiv, label: s.label }))
}

/** 분석 고르기 칸의 이름: '분기보고서 (2025.09) → 분기보고서 (2026.09)' */
export function analysisOptionLabel(analysis: CompanyAnalysisItem): string {
  return reportPairLabel(pair(analysis))
}

/** 문장 변경 검색어 길이(서버 규칙: 앞뒤 공백을 지운 2~100자) */
export const SEARCH_MIN = 2
export const SEARCH_MAX = 100

/** 문장 변경 검색어. 앞뒤 공백을 지워 2자 이상일 때만 보내고, 100자를 넘으면 앞 100자만 보낸다 */
export function searchQuery(input: string): string | null {
  const q = input.trim().slice(0, SEARCH_MAX).trim()
  return q.length >= SEARCH_MIN ? q : null
}

/** 문장 변경 후보의 쪽(0부터). 다음 쪽이 있는지는 서버가 준 전체 건수로 안다 */
export function hasNextPage(list: { page: number; size: number; totalItems: number }): boolean {
  return (list.page + 1) * list.size < list.totalItems
}

/** '21~40 / 1,054건' */
export function pageRangeLabel(list: { page: number; size: number; totalItems: number; items: readonly unknown[] }): string {
  const from = list.page * list.size + 1
  const to = list.page * list.size + list.items.length
  return `${formatInteger(from)}~${formatInteger(to)} / ${formatInteger(list.totalItems)}건`
}

/** 문장 변경 후보 찾기: 입력한 검색어와 보는 쪽(0부터). 검색어를 바꾸면 첫 쪽으로 돌아간다 */
export interface TextSearch {
  input: string
  page: number
}

export type TextSearchAction = { type: 'set-input'; input: string } | { type: 'set-page'; page: number }

export const EMPTY_TEXT_SEARCH: TextSearch = { input: '', page: 0 }

export function textSearchReducer(state: TextSearch, action: TextSearchAction): TextSearch {
  return match<TextSearchAction, TextSearch>(action)
    .with({ type: 'set-input' }, ({ input }) => ({ input, page: 0 }))
    .with({ type: 'set-page' }, ({ page }) => ({ ...state, page: Math.max(0, page) }))
    .exhaustive()
}

/** 글쓰기 칸의 변경점 붙이기 상태. pick: 붙인 변경점, picking: 고르기 대화상자가 열림 */
export interface QuoteComposer {
  pick: QuotePick | null
  picking: boolean
}

export type QuoteComposerAction =
  | { type: 'open-picker' }
  | { type: 'close-picker' }
  | { type: 'pick'; pick: QuotePick }
  | { type: 'remove' }

export const EMPTY_COMPOSER: QuoteComposer = { pick: null, picking: false }

/** 고르면 붙이고 대화상자를 닫는다. 닫기만 하면 붙인 것은 그대로다. 빼기와 올린 뒤에는 비운다(remove) */
export function quoteComposerReducer(state: QuoteComposer, action: QuoteComposerAction): QuoteComposer {
  return match<QuoteComposerAction, QuoteComposer>(action)
    .with({ type: 'open-picker' }, () => ({ ...state, picking: true }))
    .with({ type: 'close-picker' }, () => ({ ...state, picking: false }))
    .with({ type: 'pick' }, ({ pick }) => ({ pick, picking: false }))
    .with({ type: 'remove' }, () => ({ ...state, pick: null }))
    .exhaustive()
}
