import { match } from 'ts-pattern'
import type { ChatAction, ChatCitation, ChatContext, ChatCrossCheck, ChatTab } from '@/shared/api/agentChat'
import type { ComparabilityRequest } from '@/shared/api/comparability'
import type { QuoteKind } from '@/shared/api/community'
import type { ComparisonBasis } from '@/shared/api/reports'
import type { DocumentSide } from '@/shared/api/documents'
import { NOTE_MEMO_MAX, type NoteCreate } from '@/shared/api/notes'
import type { ChangeType } from '@/shared/api/textChanges'
import { communityQuoteParamChanges } from '@/shared/lib/communityQuoteLink'
import { companyComparisonPath } from '@/shared/lib/companyComparisonLink'
import { glossary, type GlossaryEntry } from '@/shared/lib/glossary'
import { formatDecimal } from '@/shared/lib/numberFormat'
import type { ParamChanges } from '@/shared/lib/searchParams'
import {
  openFinancialChanges,
  openSourceChanges,
  openTextChanges,
  textParamChanges,
  type ResultParams,
} from './resultParams'
import { CONTENT_FILTER, CONTENT_TYPES, type TextTypeFilter } from './textFilter'

/**
 * AI 에이전트 채팅의 화면 맥락·근거 칩·화면 액션을 결과 화면 주소로 잇는다(docs/api-spec.md 채팅 API).
 * 액션은 아는 종류만 실행하고, 값이 맞지 않거나 모르는 종류는 무시한다.
 */

const CHAT_TABS: readonly ChatTab[] = ['summary', 'financial', 'text', 'source']
const CHANGE_TYPES: readonly ChangeType[] = ['ADDED', 'DELETED', 'MODIFIED', 'NUMERIC_UPDATE', 'MOVED', 'REVIEW_NEEDED']

/**
 * 지금 보는 화면. 명세가 받는 네 탭일 때만 탭을 보내고(기업 개요·커뮤니티·뉴스 탭은 보내지 않음),
 * 그 탭에서 고른 변경·원문 위치를 함께 보낸다
 */
export function chatContextOf(params: ResultParams): ChatContext {
  const tab = (CHAT_TABS as readonly string[]).includes(params.tab) ? (params.tab as ChatTab) : null
  if (tab === null) return {}
  return {
    tab,
    ...(tab === 'text' && params.selectedTextChangeId !== null ? { textChangeId: params.selectedTextChangeId } : {}),
    ...(tab === 'financial' && params.selectedChangeId !== null ? { financialChangeId: params.selectedChangeId } : {}),
    ...(tab === 'source'
      ? { side: params.sourceSide, ...(params.sourceSection !== null ? { sectionNo: params.sourceSection } : {}) }
      : {}),
  }
}

/** 근거 칩을 누르면 열 곳. 결과 화면에서 열 수 없는 근거(수시공시 등)는 null */
export function citationChanges(c: ChatCitation): ParamChanges | null {
  const source = (block: number | null) =>
    c.side && c.sectionNo !== undefined ? openSourceChanges({ side: c.side, section: c.sectionNo, block }) : null
  return match(c.kind)
    .with('BLOCK', () => source(c.blockNo ?? null))
    .with('SECTION', () => source(null))
    .with('TEXT_CHANGE', () => (c.changeId !== undefined ? openTextChanges(c.changeId) : null))
    .with('FINANCIAL_CHANGE', () =>
      c.changeId !== undefined && c.sjDiv ? openFinancialChanges(c.sjDiv, c.changeId) : null,
    )
    .with('DISCLOSURE', 'REPORT_VALUE', 'COMPANY', () => null)
    .exhaustive()
}

/** 결과 화면 밖으로 여는 근거: 기업 근거는 기업 화면, 수시공시·보고서 값은 DART 원문. 없으면 null */
export type CitationLink = { kind: 'route'; to: string } | { kind: 'external'; href: string }

export function citationLink(c: ChatCitation): CitationLink | null {
  return match(c.kind)
    .with('COMPANY', () =>
      c.corpCode && CORP_CODE.test(c.corpCode) ? { kind: 'route' as const, to: `/companies/${c.corpCode}` } : null,
    )
    .with('DISCLOSURE', 'REPORT_VALUE', () =>
      c.dartUrl && DART_URL.test(c.dartUrl) ? { kind: 'external' as const, href: c.dartUrl } : null,
    )
    .with('BLOCK', 'SECTION', 'TEXT_CHANGE', 'FINANCIAL_CHANGE', () => null)
    .exhaustive()
}

/** DART 공시 주소만 새 창으로 연다(응답 값을 그대로 링크로 쓰지 않게) */
const DART_URL = /^https:\/\/dart\.fss\.or\.kr\//

/** 근거 칩 이름 */
export function citationLabel(c: ChatCitation): string {
  return match(c.kind)
    .with('FINANCIAL_CHANGE', () => c.accountName ?? '재무 수치')
    .with('TEXT_CHANGE', 'BLOCK', 'SECTION', () => lastTitle(c.sectionPath) ?? '원문')
    .with('REPORT_VALUE', () => c.label ?? c.reportName ?? '보고서 값')
    .with('COMPANY', () => c.corpName ?? '기업')
    .with('DISCLOSURE', () => c.reportName ?? '공시')
    .exhaustive()
}

/** 근거 칩에 마우스를 올렸을 때 보일 글. 보고서 값은 값과 단위를 API가 준 그대로 보인다 */
export function citationTitle(c: ChatCitation): string | undefined {
  return match(c.kind)
    .with('REPORT_VALUE', 'COMPANY', () => {
      const value = valueText(c.value, c.unit)
      const head = c.kind === 'COMPANY' ? c.label : (c.reportName ?? c.label)
      return [head, value].filter((part) => part !== null && part !== undefined && part !== '').join(': ') || undefined
    })
    .with('DISCLOSURE', () => [c.reportName, c.rceptDt].filter(Boolean).join(' · ') || undefined)
    .with('BLOCK', 'SECTION', 'TEXT_CHANGE', 'FINANCIAL_CHANGE', () => c.quote ?? c.sentence ?? c.sectionPath)
    .exhaustive()
}

function valueText(value: number | string | undefined, unit: string | undefined): string | null {
  if (value === undefined || value === null || value === '') return null
  const text = typeof value === 'number' ? formatDecimal(value) : value
  return unit ? `${text} ${unit}` : text
}

/** 칩에 붙일 설명: 새로 찾은 문장은 원인 설명처럼 보이지 않게 '관련 문장'으로 적는다(ADR-0015) */
export function citationNote(c: ChatCitation): string | null {
  if (c.grade === 'STATED') return '회사 설명'
  if (c.grade === 'RELATED') return '관련 공시 내용'
  return c.kind === 'TEXT_CHANGE' || c.kind === 'BLOCK' ? '관련 문장' : null
}

function lastTitle(path: string | undefined): string | null {
  if (!path) return null
  return path.split(' > ').at(-1)?.trim() || null
}

export type ChatActionTarget =
  | { kind: 'open'; changes: ParamChanges }
  | { kind: 'glossary'; term: string; entry: GlossaryEntry | null }
  | { kind: 'brief' }
  /** 확인 버튼: 누르면 POST /api/notes(본문은 backend가 확인해 채운 값 그대로) */
  | { kind: 'save-note'; note: NoteCreate }
  /** 확인 버튼: 누르면 PUT /api/favorite-companies/{corpCode} */
  | { kind: 'favorite'; corpCode: string }
  /** 다른 화면으로 가는 링크(다른 분석 결과, 기업 나란히 보기) */
  | { kind: 'link'; to: string }
  /** 문장 변화 탭의 변경 고정(브라우저에만 저장, 확인 없음) */
  | { kind: 'pin'; changeId: number }
  /** 확인 버튼: 누르면 POST /api/analyses 뒤 분석 진행 화면(W-02) */
  | { kind: 'request-analysis'; request: ComparabilityRequest }
  /** 커뮤니티 탭 글쓰기 칸을 초안과 인용으로 채워 연다. 저장은 사용자가 올릴 때만 */
  | { kind: 'post-draft'; body: string; quote: ParamChanges | null }
  | { kind: 'ignore' }

/** 화면 액션 하나가 할 일. citations는 재무 근거의 재무제표(sjDiv)를 찾는 데 쓴다 */
export function chatActionTarget(action: ChatAction, citations: ChatCitation[]): ChatActionTarget {
  switch (action.type) {
    case 'OPEN_TAB': {
      const tab = action.tab
      if (typeof tab !== 'string' || !(CHAT_TABS as readonly string[]).includes(tab)) return { kind: 'ignore' }
      const filters = tab === 'text' && isRecord(action.filters) ? textFilters(action.filters) : {}
      return { kind: 'open', changes: { tab, ...filters } }
    }
    case 'OPEN_TEXT_CHANGE':
      return isId(action.changeId) ? { kind: 'open', changes: openTextChanges(action.changeId) } : { kind: 'ignore' }
    case 'OPEN_FINANCIAL_CHANGE': {
      if (!isId(action.changeId)) return { kind: 'ignore' }
      const sjDiv = citations.find((c) => c.kind === 'FINANCIAL_CHANGE' && c.changeId === action.changeId)?.sjDiv
      return {
        kind: 'open',
        changes: sjDiv ? openFinancialChanges(sjDiv, action.changeId) : { tab: 'financial', change: String(action.changeId) },
      }
    }
    case 'OPEN_DOCUMENT': {
      const side = action.side
      if ((side !== 'current' && side !== 'previous') || !isId(action.sectionNo)) return { kind: 'ignore' }
      const block = isId(action.blockNo) ? action.blockNo : null
      return { kind: 'open', changes: openSourceChanges({ side: side as DocumentSide, section: action.sectionNo, block }) }
    }
    case 'OPEN_GLOSSARY':
      return typeof action.term === 'string' && action.term.trim() !== ''
        ? { kind: 'glossary', term: action.term.trim(), entry: glossaryEntryOf(action.term) }
        : { kind: 'ignore' }
    case 'DOWNLOAD_BRIEF':
      return { kind: 'brief' }
    case 'CONFIRM_SAVE_NOTE': {
      const note = isRecord(action.note) ? noteOf(action.note) : null
      return note ? { kind: 'save-note', note } : { kind: 'ignore' }
    }
    case 'CONFIRM_FAVORITE':
      return typeof action.corpCode === 'string' && CORP_CODE.test(action.corpCode)
        ? { kind: 'favorite', corpCode: action.corpCode }
        : { kind: 'ignore' }
    case 'OPEN_ANALYSIS':
      return isId(action.analysisId) ? { kind: 'link', to: `/analyses/${action.analysisId}` } : { kind: 'ignore' }
    case 'OPEN_COMPANY_COMPARE': {
      const corps = Array.isArray(action.corpCodes) ? action.corpCodes.filter((c): c is string => typeof c === 'string') : []
      const to = companyComparisonPath(corps)
      return to === null ? { kind: 'ignore' } : { kind: 'link', to }
    }
    case 'PIN_CHANGE':
      return isId(action.changeId) ? { kind: 'pin', changeId: action.changeId } : { kind: 'ignore' }
    case 'CONFIRM_REQUEST_ANALYSIS': {
      const request = analysisRequestOf(action)
      return request ? { kind: 'request-analysis', request } : { kind: 'ignore' }
    }
    case 'OPEN_POST_DRAFT': {
      if (typeof action.body !== 'string' || action.body.trim() === '') return { kind: 'ignore' }
      const quote = isRecord(action.quote) ? postQuoteOf(action.quote, citations) : null
      return { kind: 'post-draft', body: action.body.trim(), quote }
    }
    default:
      return { kind: 'ignore' }
  }
}

/** 용어 사전(shared/lib/glossary)에서 이름이 같은 용어(공백 무시). 없으면 null이고 뜻을 지어내지 않는다 */
export function glossaryEntryOf(term: string): GlossaryEntry | null {
  const key = squeeze(term)
  return Object.values(glossary).find((entry) => squeeze(entry.term) === key) ?? null
}

/** 문장 변화 탭 거르기. 액션의 type은 쉼표로 이은 유형이라 화면의 거르기 하나(한 유형 또는 '내용 변경')로 바꾼다 */
function textFilters(filters: Record<string, unknown>): ParamChanges {
  return textParamChanges({
    type: typeFilterOf(filters.type),
    sort: filters.sort === 'document' ? 'document' : 'priority',
    section: typeof filters.section === 'string' && filters.section.trim() !== '' ? filters.section.trim() : null,
    q: typeof filters.q === 'string' && filters.q.trim().length >= 2 ? filters.q.trim() : null,
    risk: filters.risk === true,
    // 분야 거르기가 남으면 접힌 변경을 찾지 못한다(3.29)
    field: null,
  })
}

function typeFilterOf(value: unknown): TextTypeFilter | null {
  if (typeof value !== 'string') return null
  const types = [...new Set(value.split(',').map((t) => t.trim()).filter((t) => t !== ''))]
  if (types.length === 1 && (CHANGE_TYPES as readonly string[]).includes(types[0])) return types[0] as ChangeType
  const content = [...CONTENT_TYPES].sort().join(',')
  return types.length === CONTENT_TYPES.length && [...types].sort().join(',') === content ? CONTENT_FILTER : null
}

/** 고유번호 8자리 */
const CORP_CODE = /^\d{8}$/
/** 접수번호 14자리 */
const RCEPT_NO = /^\d{14}$/
const BASES: readonly ComparisonBasis[] = ['YOY', 'PREV', 'CUSTOM']
const QUOTE_KINDS: readonly QuoteKind[] = ['FINANCIAL_CHANGE', 'TEXT_CHANGE']

function analysisRequestOf(action: ChatAction): ComparabilityRequest | null {
  const { corpCode, previousRceptNo, currentRceptNo, basis } = action
  if (typeof corpCode !== 'string' || !CORP_CODE.test(corpCode)) return null
  if (typeof previousRceptNo !== 'string' || !RCEPT_NO.test(previousRceptNo)) return null
  if (typeof currentRceptNo !== 'string' || !RCEPT_NO.test(currentRceptNo)) return null
  if (typeof basis !== 'string' || !(BASES as readonly string[]).includes(basis)) return null
  return { corpCode, previousRceptNo, currentRceptNo, basis: basis as ComparisonBasis }
}

/** 글 초안의 인용(게시판 글 quote와 같은 모양)을 커뮤니티 탭 인용 쿼리로. 재무는 근거 칩의 재무제표를 함께 넘긴다 */
function postQuoteOf(raw: Record<string, unknown>, citations: ChatCitation[]): ParamChanges | null {
  const kind = QUOTE_KINDS.find((k) => k === raw.kind)
  if (kind === undefined || !isId(raw.analysisId) || !isId(raw.changeId)) return null
  const changeId = raw.changeId
  const sjDiv =
    kind === 'FINANCIAL_CHANGE'
      ? (citations.find((c) => c.kind === 'FINANCIAL_CHANGE' && c.changeId === changeId)?.sjDiv ?? null)
      : null
  return communityQuoteParamChanges({ analysisId: raw.analysisId, kind, changeId, sjDiv })
}

/** 교차 검증 결과의 제목과 색. 어긋남도 '검토해 볼 신호'로만 보이고 오류처럼 보이지 않게 한다(AC19) */
export function crossCheckView(check: ChatCrossCheck): { title: string; tone: 'info' | 'attention' } {
  return match(check.result)
    .with('CONSISTENT', () => ({ title: '방향이 맞아요', tone: 'info' as const }))
    .with('POTENTIAL_MISMATCH', () => ({ title: '검토해 볼 신호', tone: 'attention' as const }))
    .with('INSUFFICIENT_EVIDENCE', () => ({ title: '대조할 근거가 부족해요', tone: 'info' as const }))
    .with('NOT_COMPARABLE', () => ({ title: '기준이 달라 대조하지 않았어요', tone: 'info' as const }))
    .exhaustive()
}

export const CROSS_CHECK_NOTE = '공시 수치와 회사 설명의 방향만 비교한 결과예요.'

/** 정리 형식(BRIEF) 답의 줄. 빈 줄은 빼고 줄 앞의 '- '는 목록 표시로 바꾸므로 뗀다(AC24) */
export function briefLines(answer: string): string[] {
  return answer
    .split('\n')
    .map((line) => line.trim().replace(/^-\s+/, ''))
    .filter((line) => line !== '')
}

/** 노트에 담기 액션의 note를 POST /api/notes 본문으로. 종류에 필요한 ID가 없거나 메모가 글이 아니면 null */
function noteOf(raw: Record<string, unknown>): NoteCreate | null {
  if (!isId(raw.analysisId)) return null
  const memo = raw.memo === undefined || raw.memo === null ? null : raw.memo
  if (memo !== null && (typeof memo !== 'string' || memo.length > NOTE_MEMO_MAX)) return null
  const base = { analysisId: raw.analysisId, memo: memo === null || memo.trim() === '' ? null : memo }
  switch (raw.kind) {
    case 'FINANCIAL_CHANGE':
    case 'TEXT_CHANGE':
      return isId(raw.changeId) ? { kind: raw.kind, changeId: raw.changeId, ...base } : null
    case 'ANSWER_CITATION':
      return isId(raw.questionId) && isId(raw.citationNo)
        ? { kind: 'ANSWER_CITATION', questionId: raw.questionId, citationNo: raw.citationNo, ...base }
        : null
    default:
      return null
  }
}

function isId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function squeeze(text: string): string {
  return text.replace(/\s+/g, '')
}

export type ChatAnswerSegment = { kind: 'text'; text: string } | { kind: 'citation'; citation: ChatCitation }

/** 답을 글·근거 조각으로 나눈다. 응답에 없는 번호는 근거로 보이지 않고 글 그대로 둔다 */
export function parseChatAnswer(answer: string, citations: ChatCitation[]): ChatAnswerSegment[] {
  const byNo = new Map(citations.map((c) => [c.no, c]))
  const segments: ChatAnswerSegment[] = []
  let cursor = 0
  for (const m of answer.matchAll(/\[(\d+)\]/g)) {
    const citation = byNo.get(Number(m[1]))
    if (!citation) continue
    if (m.index > cursor) segments.push({ kind: 'text', text: answer.slice(cursor, m.index) })
    segments.push({ kind: 'citation', citation })
    cursor = m.index + m[0].length
  }
  if (cursor < answer.length) segments.push({ kind: 'text', text: answer.slice(cursor) })
  return segments
}
