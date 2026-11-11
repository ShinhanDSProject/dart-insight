import type { Analysis } from '@/shared/api/analyses'
import type { DocumentSide } from '@/shared/api/documents'
import type { SjDiv } from '@/shared/api/results'
import type { SummaryLens } from '@/shared/api/summary'
import type { ChangeType, TextField, TextSort } from '@/shared/api/textChanges'
import { positiveInt, type ParamChanges } from '@/shared/lib/searchParams'
import { parseUnit, type AmountUnit } from './format'
import { parseSummaryLens, type SummaryView } from './summaryLens'
import { accountQueryOf } from './accountFilter'
import type { FinancialTableOrder } from './financialSort'
import { CONTENT_FILTER, searchQueryOf, type TextTypeFilter } from './textFilter'
import { parseTextField } from './textFields'

/**
 * W-03 결과 화면의 주소 상태(ST-6).
 * ?tab=overview 기업 개요(#589), ?slens=&sview= 요약(관점 거르기·보기), ?tab=&sj=&changed=&unit=&fq=&fsort=&change= 재무 수치, ?tab=activity 공시 분석(두 보고서 사이 활동과 앞으로의 영향, ADR-0067), ?tab=community 커뮤니티(#575), ?tab=news 뉴스(#592), ?ttype=&tsort=&tsec=&tq=&trisk=&tfield=&tpin=&tsel=&tc= 전체 변경(문장 변경 전체 목록), ?doc=&section=&block= 원문 확인
 */
export type ResultTab = 'overview' | 'summary' | 'financial' | 'activity' | 'text' | 'community' | 'news' | 'source' | 'reports'

export const resultTabs: ResultTab[] = ['overview', 'summary', 'financial', 'activity', 'text', 'community', 'news', 'source', 'reports']
const sjDivs: SjDiv[] = ['BS', 'IS', 'CIS', 'CF', 'SCE']
const textTypeFilters: TextTypeFilter[] = ['ADDED', 'DELETED', 'MODIFIED', 'NUMERIC_UPDATE', 'MOVED', 'REVIEW_NEEDED', CONTENT_FILTER]

/** 원문 확인(3.5)에서 열 위치 */
export interface SourceTarget {
  side: DocumentSide
  section: number
  block: number | null
}

export interface ResultParams {
  tab: ResultTab
  /** 요약에서 고른 투자자 관점(FS-64). null이면 전체 */
  summaryLens: SummaryLens | null
  /** 요약을 관점별로 묶어 볼지(기본) 목록으로 볼지 */
  summaryView: SummaryView
  sjDiv: SjDiv
  changedOnly: boolean
  unit: AmountUnit
  /** 근거를 보고 있는 계정(3.3) */
  selectedChangeId: number | null
  /** 계정 찾기 검색어(FS-14). 재무제표를 바꿔도 남는다. 없으면 null */
  accountQuery: string | null
  /** 계정 목록 순서. 기본은 증감액 큰 순(FS-68), fsort=document 원문 순서, fsort=scale 규모 큰 순(#480) */
  financialOrder: FinancialTableOrder
  /** 유형 거르기. CONTENT는 '내용 변경'(추가·삭제·수정, #304). null이면 전체 */
  textType: TextTypeFilter | null
  textSort: TextSort
  /** 고른 최상위 섹션 제목(3.7). null이면 전체 */
  textSection: string | null
  /** 문장 검색어(3.7). 2자 미만이면 null */
  textQuery: string | null
  /** 위험 관련 목차의 변경만 보는지(3.9, trisk=1) */
  textRisk: boolean
  /** 분야별 표에서 고른 분야(3.28, tfield). null이면 전체 */
  textField: TextField | null
  /** 고정한 변경만 보는지(3.3, tpin=1) */
  textPinned: boolean
  /** 근거를 보고 있는 문장 변경(3.4) */
  selectedTextChangeId: number | null
  /** 목록에서 골라 상세 칸에 보이는 문장 변경(3.54, tsel). null이면 목록의 첫 변경 */
  textDetailId: number | null
  sourceSide: DocumentSide
  sourceSection: number | null
  sourceBlock: number | null
}

/** 주소 값을 읽는다. 모르는 값은 기본값으로 본다 */
export function parseResultParams(params: URLSearchParams): ResultParams {
  const tab = params.get('tab')
  const sj = params.get('sj')
  const ttype = params.get('ttype')
  return {
    tab: resultTabs.includes(tab as ResultTab) ? (tab as ResultTab) : 'summary',
    summaryLens: parseSummaryLens(params.get('slens')),
    summaryView: params.get('sview') === 'list' ? 'list' : 'lens',
    sjDiv: sjDivs.includes(sj as SjDiv) ? (sj as SjDiv) : 'BS',
    changedOnly: params.get('changed') === '1',
    unit: parseUnit(params.get('unit')),
    selectedChangeId: positiveInt(params.get('change')),
    accountQuery: accountQueryOf(params.get('fq') ?? ''),
    financialOrder: parseFinancialOrder(params.get('fsort')),
    textType: textTypeFilters.includes(ttype as TextTypeFilter) ? (ttype as TextTypeFilter) : null,
    textSort: params.get('tsort') === 'priority' ? 'priority' : 'document',
    textSection: params.get('tsec')?.trim() || null,
    textQuery: searchQueryOf(params.get('tq') ?? ''),
    textRisk: params.get('trisk') === '1',
    textField: parseTextField(params.get('tfield')),
    textPinned: params.get('tpin') === '1',
    selectedTextChangeId: positiveInt(params.get('tc')),
    textDetailId: positiveInt(params.get('tsel')),
    sourceSide: params.get('doc') === 'previous' ? 'previous' : 'current',
    sourceSection: positiveInt(params.get('section')),
    sourceBlock: positiveInt(params.get('block')),
  }
}

/** 재무 표 순서. 모르는 값이나 값이 없으면 증감액 큰 순(기본). 예전 주소의 fsort=scale은 그대로 읽는다 */
function parseFinancialOrder(value: string | null): FinancialTableOrder {
  return value === 'document' || value === 'scale' ? value : 'amount'
}

export interface SummaryViewChange {
  /** null이면 전체(주소에서 지운다) */
  lens?: SummaryLens | null
  view?: SummaryView
}

/** 요약의 관점 거르기·보기를 주소 값으로. 기본값(전체·관점별)은 주소에서 지운다 */
export function summaryParamChanges(c: SummaryViewChange): ParamChanges {
  return {
    ...(c.lens !== undefined ? { slens: c.lens } : {}),
    ...(c.view !== undefined ? { sview: c.view === 'lens' ? null : c.view } : {}),
  }
}

export interface FinancialViewChange {
  sj?: SjDiv
  changed?: boolean
  unit?: AmountUnit
  /** 계정 찾기 검색어. null이면 주소에서 지운다 */
  q?: string | null
  /** 계정 목록 순서. 증감액 큰 순(기본)이면 주소에서 지운다 */
  order?: FinancialTableOrder
  change?: number | null
}

export interface TextViewChange {
  type?: TextTypeFilter | null
  sort?: TextSort
  section?: string | null
  q?: string | null
  /** 위험 관련 목차의 변경만 보기(3.9) */
  risk?: boolean
  /** 분야별 표의 칸(3.28). 고르면 칸의 건수와 맞도록 유형·섹션·검색어·위험 관련·고정 보기를 지운다 */
  field?: TextField | null
  /** 고정한 변경만 보기(3.3). 켜면 유형·섹션·검색어·위험 관련·분야를 지운다 */
  pinned?: boolean
  change?: number | null
  /** 상세 칸에 보일 변경(3.54) */
  detail?: number | null
}

export interface SourceViewChange {
  side?: DocumentSide
  section?: number | null
  block?: number | null
}

const idParam = (id: number | null): string | null => (id === null ? null : String(id))

/** 재무 수치 탭의 고르기를 주소 값으로. 재무제표를 바꾸면 보던 근거를 닫는다. 계정 찾기 검색어는 재무제표를 바꿔도 남긴다 */
export function financialParamChanges(c: FinancialViewChange): ParamChanges {
  return {
    ...(c.sj !== undefined ? { sj: c.sj, change: null } : {}),
    ...(c.change !== undefined ? { change: idParam(c.change) } : {}),
    ...(c.changed !== undefined ? { changed: c.changed ? '1' : null } : {}),
    ...(c.unit !== undefined ? { unit: c.unit } : {}),
    ...(c.q !== undefined ? { fq: c.q } : {}),
    ...(c.order !== undefined ? { fsort: c.order === 'amount' ? null : c.order } : {}),
  }
}

/**
 * 문장 변화 탭의 고르기를 주소 값으로. 거르기·정렬·섹션·검색어·위험 관련을 바꾸면 보던 근거를 닫고 상세 칸의 고른 변경도 지운다(3.54).
 * '고정' 보기는 유형·섹션·검색어·위험 관련과 함께 쓰지 않는다. 켜면 그것들을 지우고, 그것들을 고르면 '고정' 보기를 끈다.
 */
export function textParamChanges(c: TextViewChange): ParamChanges {
  return {
    ...(c.type !== undefined ? { ttype: c.type, tpin: null, tc: null, tsel: null } : {}),
    ...(c.sort !== undefined ? { tsort: c.sort === 'document' ? null : c.sort, tc: null, tsel: null } : {}),
    ...(c.section !== undefined ? { tsec: c.section, tpin: null, tc: null, tsel: null } : {}),
    ...(c.q !== undefined ? { tq: c.q, tpin: null, tc: null, tsel: null } : {}),
    ...(c.risk !== undefined ? { trisk: c.risk ? '1' : null, tpin: null, tc: null, tsel: null } : {}),
    ...(c.field !== undefined ? fieldParamChanges(c.field) : {}),
    ...(c.pinned !== undefined ? pinnedParamChanges(c.pinned) : {}),
    ...(c.change !== undefined ? { tc: idParam(c.change) } : {}),
    ...(c.detail !== undefined ? { tsel: idParam(c.detail) } : {}),
  }
}

/** 칸을 고르면 목록이 칸의 건수와 맞도록 다른 거르기를 지우고, 풀면 분야만 지운다. 어느 쪽이든 보던 근거를 닫는다 */
function fieldParamChanges(field: TextField | null): ParamChanges {
  if (field === null) return { tfield: null, tc: null, tsel: null }
  return { tfield: field, ttype: null, tsec: null, tq: null, trisk: null, tpin: null, tc: null, tsel: null }
}

/** '고정' 보기를 켜면 유형·섹션·검색어·위험 관련·분야를 지우고, 끄면 '고정'만 지운다. 어느 쪽이든 보던 근거를 닫는다 */
function pinnedParamChanges(pinned: boolean): ParamChanges {
  if (pinned) return { tpin: '1', ttype: null, tsec: null, tq: null, trisk: null, tfield: null, tc: null, tsel: null }
  return { tpin: null, tc: null, tsel: null }
}

export function sourceParamChanges(c: SourceViewChange): ParamChanges {
  return {
    ...(c.side !== undefined ? { doc: c.side } : {}),
    ...(c.section !== undefined ? { section: idParam(c.section) } : {}),
    ...(c.block !== undefined ? { block: idParam(c.block) } : {}),
  }
}

/** 다른 탭에서 원문 확인 탭의 그 위치로 간다 */
export function openSourceChanges(target: SourceTarget): ParamChanges {
  return { tab: 'source', doc: target.side, section: String(target.section), block: idParam(target.block) }
}

/**
 * '보고서 선택' 탭(#659)에서 처음 고른 값: 이 분석의 현재 보고서·비교 기준, 직접 선택이면 이전 보고서.
 * 보고서 선택(report-selection)과 같은 주소 값(?current=&basis=&previous=)이다. 이미 고른 값이 주소에 있으면 null(그대로 둔다)
 */
export function reportSelectionSeed(analysis: Analysis, params: URLSearchParams): ParamChanges | null {
  if (params.has('current')) return null
  return {
    current: analysis.current.rceptNo,
    basis: analysis.basis,
    previous: analysis.basis === 'CUSTOM' ? analysis.previous.rceptNo : null,
  }
}

/** 요약에서 재무 수치 탭의 그 계정 근거로 간다(전체 계정 보기, 계정 찾기는 지워 그 계정이 표에 보이게 한다) */
export function openFinancialChanges(sjDiv: SjDiv, changeId: number): ParamChanges {
  return { tab: 'financial', sj: sjDiv, change: String(changeId), changed: null, fq: null }
}

/** 요약에서 문장 변화 탭의 그 변경 근거로 간다(거르기·정렬·섹션·검색어·위험 관련은 기본값) */
export function openTextChanges(changeId: number): ParamChanges {
  return { tab: 'text', ttype: null, tsort: null, tsec: null, tq: null, trisk: null, tfield: null, tpin: null, tc: String(changeId) }
}

/** 요약의 변화 개요에서 재무 수치 탭을 '변경 항목만'으로 연다(계정 찾기는 지운다). 재무제표를 주지 않으면 고른 것을 그대로 둔다 */
export function openChangedAccounts(sjDiv: SjDiv | null): ParamChanges {
  return { tab: 'financial', ...(sjDiv !== null ? { sj: sjDiv } : {}), changed: '1', change: null, fq: null }
}

/** 요약의 변화 개요에서 문장 변화 탭을 그 유형으로 거른다(null이면 전체). 개요 건수와 맞도록 섹션·검색어·위험 관련 거르기는 끈다 */
export function openTextList(type: ChangeType | null): ParamChanges {
  return { tab: 'text', ttype: type, tsort: null, tsec: null, tq: null, trisk: null, tfield: null, tpin: null, tc: null }
}

/**
 * 변화 개요의 '먼저 볼 것'(FS-68 AC2)에서 문장 변화 탭을 우선순위 순으로 연다. 우선순위 높음은 분석 전체에서 센 수라
 * 맨 위에 그 변경들이 오도록 유형·섹션·검색어·위험 관련·고정 거르기를 모두 지운다(우선순위 수준 거르기는 API에 없음)
 */
export function openPriorityList(): ParamChanges {
  return { tab: 'text', ttype: null, tsort: null, tsec: null, tq: null, trisk: null, tfield: null, tpin: null, tc: null }
}

/** 요약의 섹션별 문장 변경 막대에서 문장 변화 탭을 그 최상위 섹션으로 거른다(#295). 막대 건수와 맞도록 유형·검색어·위험 관련은 지운다 */
export function openTextSection(section: string): ParamChanges {
  return { tab: 'text', ttype: null, tsort: null, tsec: section, tq: null, trisk: null, tfield: null, tpin: null, tc: null }
}

/**
 * 예전 AI 질문 탭 주소(?tab=ask)인지. 이 탭은 없어졌고(#575) AI 질문은 채팅 패널로 바뀌어(#579),
 * 이 주소로 들어오면 요약 탭을 보이고 채팅 패널을 연다
 */
export function isLegacyAskTab(params: URLSearchParams): boolean {
  return params.get('tab') === 'ask'
}

/** AI 질문이 있는 요약 탭으로 간다(3.10, #575). 질문·답은 주소에 남기지 않는다 */
export function openAsk(): ParamChanges {
  return { tab: 'summary' }
}

/** AI 질문에서 찾지 못한 질문을 문장 변화 탭의 검색으로 넘긴다(유형·정렬·섹션·위험 관련은 기본값). 낱말이 없으면 검색 없이 연다 */
export function openTextSearch(q: string | null): ParamChanges {
  return { tab: 'text', ttype: null, tsort: null, tsec: null, tq: q, trisk: null, tfield: null, tpin: null, tc: null }
}
