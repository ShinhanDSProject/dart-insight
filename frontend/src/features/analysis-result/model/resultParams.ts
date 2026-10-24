import type { DocumentSide } from '@/shared/api/documents'
import type { SjDiv } from '@/shared/api/results'
import type { ChangeType, TextSort } from '@/shared/api/textChanges'
import { positiveInt, type ParamChanges } from '@/shared/lib/searchParams'
import { parseUnit, type AmountUnit } from './format'
import { accountQueryOf } from './accountFilter'
import { searchQueryOf } from './textFilter'

/**
 * W-03 결과 화면의 주소 상태(ST-6).
 * ?tab=&sj=&changed=&unit=&fq=&change= 재무 수치, ?tab=ask AI 질문, ?ttype=&tsort=&tsec=&tq=&tpin=&tc= 문장 변화, ?doc=&section=&block= 원문 확인
 */
export type ResultTab = 'summary' | 'financial' | 'text' | 'ask' | 'source'

export const resultTabs: ResultTab[] = ['summary', 'financial', 'text', 'ask', 'source']
const sjDivs: SjDiv[] = ['BS', 'IS', 'CIS', 'CF', 'SCE']
const changeTypes: ChangeType[] = ['ADDED', 'DELETED', 'MODIFIED', 'REVIEW_NEEDED']

/** 원문 확인(3.5)에서 열 위치 */
export interface SourceTarget {
  side: DocumentSide
  section: number
  block: number | null
}

export interface ResultParams {
  tab: ResultTab
  sjDiv: SjDiv
  changedOnly: boolean
  unit: AmountUnit
  /** 근거를 보고 있는 계정(3.3) */
  selectedChangeId: number | null
  /** 계정 찾기 검색어(FS-14). 재무제표를 바꿔도 남는다. 없으면 null */
  accountQuery: string | null
  textType: ChangeType | null
  textSort: TextSort
  /** 고른 최상위 섹션 제목(3.7). null이면 전체 */
  textSection: string | null
  /** 문장 검색어(3.7). 2자 미만이면 null */
  textQuery: string | null
  /** 고정한 변경만 보는지(3.3, tpin=1) */
  textPinned: boolean
  /** 근거를 보고 있는 문장 변경(3.4) */
  selectedTextChangeId: number | null
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
    sjDiv: sjDivs.includes(sj as SjDiv) ? (sj as SjDiv) : 'BS',
    changedOnly: params.get('changed') === '1',
    unit: parseUnit(params.get('unit')),
    selectedChangeId: positiveInt(params.get('change')),
    accountQuery: accountQueryOf(params.get('fq') ?? ''),
    textType: changeTypes.includes(ttype as ChangeType) ? (ttype as ChangeType) : null,
    textSort: params.get('tsort') === 'document' ? 'document' : 'priority',
    textSection: params.get('tsec')?.trim() || null,
    textQuery: searchQueryOf(params.get('tq') ?? ''),
    textPinned: params.get('tpin') === '1',
    selectedTextChangeId: positiveInt(params.get('tc')),
    sourceSide: params.get('doc') === 'previous' ? 'previous' : 'current',
    sourceSection: positiveInt(params.get('section')),
    sourceBlock: positiveInt(params.get('block')),
  }
}

export interface FinancialViewChange {
  sj?: SjDiv
  changed?: boolean
  unit?: AmountUnit
  /** 계정 찾기 검색어. null이면 주소에서 지운다 */
  q?: string | null
  change?: number | null
}

export interface TextViewChange {
  type?: ChangeType | null
  sort?: TextSort
  section?: string | null
  q?: string | null
  /** 고정한 변경만 보기(3.3). 켜면 유형·섹션·검색어를 지운다 */
  pinned?: boolean
  change?: number | null
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
  }
}

/**
 * 문장 변화 탭의 고르기를 주소 값으로. 거르기·정렬·섹션·검색어를 바꾸면 보던 근거를 닫는다.
 * '고정' 보기는 유형·섹션·검색어와 함께 쓰지 않는다. 켜면 그것들을 지우고, 그것들을 고르면 '고정' 보기를 끈다.
 */
export function textParamChanges(c: TextViewChange): ParamChanges {
  return {
    ...(c.type !== undefined ? { ttype: c.type, tpin: null, tc: null } : {}),
    ...(c.sort !== undefined ? { tsort: c.sort === 'priority' ? null : c.sort, tc: null } : {}),
    ...(c.section !== undefined ? { tsec: c.section, tpin: null, tc: null } : {}),
    ...(c.q !== undefined ? { tq: c.q, tpin: null, tc: null } : {}),
    ...(c.pinned !== undefined ? (c.pinned ? { tpin: '1', ttype: null, tsec: null, tq: null, tc: null } : { tpin: null, tc: null }) : {}),
    ...(c.change !== undefined ? { tc: idParam(c.change) } : {}),
  }
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

/** 요약에서 재무 수치 탭의 그 계정 근거로 간다(전체 계정 보기, 계정 찾기는 지워 그 계정이 표에 보이게 한다) */
export function openFinancialChanges(sjDiv: SjDiv, changeId: number): ParamChanges {
  return { tab: 'financial', sj: sjDiv, change: String(changeId), changed: null, fq: null }
}

/** 요약에서 문장 변화 탭의 그 변경 근거로 간다(거르기·정렬·섹션·검색어는 기본값) */
export function openTextChanges(changeId: number): ParamChanges {
  return { tab: 'text', ttype: null, tsort: null, tsec: null, tq: null, tpin: null, tc: String(changeId) }
}

/** 요약의 변화 개요에서 재무 수치 탭을 '변경 항목만'으로 연다(계정 찾기는 지운다). 재무제표를 주지 않으면 고른 것을 그대로 둔다 */
export function openChangedAccounts(sjDiv: SjDiv | null): ParamChanges {
  return { tab: 'financial', ...(sjDiv !== null ? { sj: sjDiv } : {}), changed: '1', change: null, fq: null }
}

/** 요약의 변화 개요에서 문장 변화 탭을 그 유형으로 거른다(null이면 전체) */
export function openTextList(type: ChangeType | null): ParamChanges {
  return { tab: 'text', ttype: type, tsort: null, tpin: null, tc: null }
}

/** 요약의 섹션별 문장 변경 막대에서 문장 변화 탭을 그 최상위 섹션으로 거른다(#295). 막대 건수와 맞도록 유형·검색어는 지운다 */
export function openTextSection(section: string): ParamChanges {
  return { tab: 'text', ttype: null, tsort: null, tsec: section, tq: null, tpin: null, tc: null }
}

/** AI 질문 탭으로 간다(3.10). 질문·답은 주소에 남기지 않는다 */
export function openAsk(): ParamChanges {
  return { tab: 'ask' }
}

/** AI 질문에서 찾지 못한 질문을 문장 변화 탭의 검색으로 넘긴다(유형·정렬·섹션은 기본값). 낱말이 없으면 검색 없이 연다 */
export function openTextSearch(q: string | null): ParamChanges {
  return { tab: 'text', ttype: null, tsort: null, tsec: null, tq: q, tpin: null, tc: null }
}
