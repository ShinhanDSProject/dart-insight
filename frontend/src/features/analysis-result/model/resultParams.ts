import type { DocumentSide } from '@/shared/api/documents'
import type { SjDiv } from '@/shared/api/results'
import type { ChangeType, TextSort } from '@/shared/api/textChanges'
import { positiveInt, type ParamChanges } from '@/shared/lib/searchParams'
import { parseUnit, type AmountUnit } from './format'

/**
 * W-03 결과 화면의 주소 상태(ST-6).
 * ?tab=&sj=&changed=&unit=&change= 재무 수치, ?ttype=&tsort=&tc= 문장 변화, ?doc=&section=&block= 원문 확인
 */
export type ResultTab = 'summary' | 'financial' | 'text' | 'source'

export const resultTabs: ResultTab[] = ['summary', 'financial', 'text', 'source']
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
  textType: ChangeType | null
  textSort: TextSort
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
    textType: changeTypes.includes(ttype as ChangeType) ? (ttype as ChangeType) : null,
    textSort: params.get('tsort') === 'document' ? 'document' : 'priority',
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
  change?: number | null
}

export interface TextViewChange {
  type?: ChangeType | null
  sort?: TextSort
  change?: number | null
}

export interface SourceViewChange {
  side?: DocumentSide
  section?: number | null
  block?: number | null
}

const idParam = (id: number | null): string | null => (id === null ? null : String(id))

/** 재무 수치 탭의 고르기를 주소 값으로. 재무제표를 바꾸면 보던 근거를 닫는다 */
export function financialParamChanges(c: FinancialViewChange): ParamChanges {
  return {
    ...(c.sj !== undefined ? { sj: c.sj, change: null } : {}),
    ...(c.change !== undefined ? { change: idParam(c.change) } : {}),
    ...(c.changed !== undefined ? { changed: c.changed ? '1' : null } : {}),
    ...(c.unit !== undefined ? { unit: c.unit } : {}),
  }
}

/** 문장 변화 탭의 고르기를 주소 값으로. 거르기·정렬을 바꾸면 보던 근거를 닫는다 */
export function textParamChanges(c: TextViewChange): ParamChanges {
  return {
    ...(c.type !== undefined ? { ttype: c.type, tc: null } : {}),
    ...(c.sort !== undefined ? { tsort: c.sort === 'priority' ? null : c.sort, tc: null } : {}),
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

/** 요약에서 재무 수치 탭의 그 계정 근거로 간다(전체 계정 보기) */
export function openFinancialChanges(sjDiv: SjDiv, changeId: number): ParamChanges {
  return { tab: 'financial', sj: sjDiv, change: String(changeId), changed: null }
}

/** 요약에서 문장 변화 탭의 그 변경 근거로 간다(거르기·정렬은 기본값) */
export function openTextChanges(changeId: number): ParamChanges {
  return { tab: 'text', ttype: null, tsort: null, tc: String(changeId) }
}

/** 요약의 변화 개요에서 재무 수치 탭을 '변경 항목만'으로 연다. 재무제표를 주지 않으면 고른 것을 그대로 둔다 */
export function openChangedAccounts(sjDiv: SjDiv | null): ParamChanges {
  return { tab: 'financial', ...(sjDiv !== null ? { sj: sjDiv } : {}), changed: '1', change: null }
}

/** 요약의 변화 개요에서 문장 변화 탭을 그 유형으로 거른다(null이면 전체) */
export function openTextList(type: ChangeType | null): ParamChanges {
  return { tab: 'text', ttype: type, tsort: null, tc: null }
}
