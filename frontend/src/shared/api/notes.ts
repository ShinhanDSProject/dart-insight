import { apiDelete, apiGet, apiGetText, apiPost, apiPut } from './client'
import { endpoints } from './endpoints'
import type { SjDiv } from './results'
import type { ChangeType } from './textChanges'

/** docs/api-spec.md /api/notes (6.5, FS-57). 로그인한 회원만 쓴다 */
export type NoteKind = 'FINANCIAL_CHANGE' | 'TEXT_CHANGE'

/** 원래 위치. 결과 화면의 그 근거와 DART 원문으로 돌아간다 */
export interface NoteSource {
  analysisId: number | null
  analysisVersion: string | null
  changeId: number | null
  /** 재무만 */
  sjDiv: SjDiv | null
  rceptNo: string | null
  /** 문장만 */
  sectionNo: number | null
  blockNo: number | null
  dartUrl: string | null
}

export interface NoteItem {
  itemId: number
  corpCode: string
  kind: NoteKind
  /** 담을 때의 이름(재무 '재무제표 · 계정명', 문장 섹션 경로) */
  label: string
  /** 담을 때의 값·문장. 서버가 저장된 근거로 만든 사본이라 화면에서 다시 계산하지 않는다 */
  text: string
  /** 문장 변경 유형. 재무는 null */
  changeType: ChangeType | null
  memo: string | null
  source: NoteSource
  /** 담을 때의 분석 버전이 지금 서버 버전과 다름 */
  outdated: boolean
  createdAt: string
  updatedAt: string
}

export interface CompanyNote {
  corpCode: string
  /** 기업 목록에 없으면 null */
  corpName: string | null
  items: NoteItem[]
}

export interface NoteList {
  companies: CompanyNote[]
}

export interface NoteCreate {
  kind: NoteKind
  analysisId: number
  changeId: number
  memo: string | null
}

/** 메모 최대 글자 수(서버와 같음) */
export const NOTE_MEMO_MAX = 1000

export function getNotes(signal?: AbortSignal): Promise<NoteList> {
  return apiGet(endpoints.notes(), undefined, { signal })
}

/** 사본은 서버가 analysisId·changeId로 만든다. 화면이 보이는 글을 보내지 않는다 */
export function createNote(body: NoteCreate): Promise<NoteItem> {
  return apiPost(endpoints.notes(), body)
}

export function updateNoteMemo(itemId: number, memo: string | null): Promise<NoteItem> {
  return apiPut(endpoints.noteMemo(itemId), { memo })
}

export function deleteNote(itemId: number): Promise<void> {
  return apiDelete(endpoints.note(itemId))
}

/** 기업 노트 Markdown(출처 포함) */
export function exportNotes(corpCode: string): Promise<string> {
  return apiGetText(endpoints.notesExport(), { corpCode })
}
