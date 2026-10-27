import { apiDelete, apiGet, apiGetText, apiPost, apiPut } from './client'
import { endpoints } from './endpoints'
import type { DocumentSide } from './documents'
import type { SjDiv } from './results'
import type { ChangeType } from './textChanges'

/** docs/api-spec.md /api/notes (6.5, FS-57). 로그인한 회원만 쓴다 */
export type NoteKind = 'FINANCIAL_CHANGE' | 'TEXT_CHANGE' | 'ANSWER_CITATION'

/** 원래 위치. 결과 화면의 그 근거와 DART 원문으로 돌아간다 */
export interface NoteSource {
  analysisId: number | null
  analysisVersion: string | null
  changeId: number | null
  /** 재무만 */
  sjDiv: SjDiv | null
  rceptNo: string | null
  /** 문장·AI 답 인용만 */
  sectionNo: number | null
  blockNo: number | null
  /** AI 답 인용만. 담은 질문 */
  questionId: number | null
  /** AI 답 인용만. 원문 확인 탭에서 열 보고서 쪽 */
  side: DocumentSide | null
  dartUrl: string | null
}

export interface NoteItem {
  itemId: number
  corpCode: string
  kind: NoteKind
  /** 담을 때의 이름(재무 '재무제표 · 계정명', 문장·AI 답 인용 섹션 경로) */
  label: string
  /** 담을 때의 값·문장. 서버가 저장된 근거로 만든 사본이라 화면에서 다시 계산하지 않는다 */
  text: string
  /** AI 답 인용만. 담을 때의 질문(사본). 다른 종류는 null */
  question: string | null
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

/** 담을 근거. 재무·문장은 변경 ID, AI 답 인용은 질문 ID와 인용 번호(citations[].no) */
export type NoteTarget =
  | { kind: 'FINANCIAL_CHANGE' | 'TEXT_CHANGE'; changeId: number }
  | { kind: 'ANSWER_CITATION'; questionId: number; citationNo: number }

export type NoteCreate = NoteTarget & {
  analysisId: number
  memo: string | null
}

/** 메모 최대 글자 수(서버와 같음) */
export const NOTE_MEMO_MAX = 1000

export function getNotes(signal?: AbortSignal): Promise<NoteList> {
  return apiGet(endpoints.notes(), undefined, { signal })
}

/** 사본은 서버가 analysisId·changeId(AI 답 인용은 questionId·citationNo)로 만든다. 화면이 보이는 글을 보내지 않는다 */
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
