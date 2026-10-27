import { describe, expect, it } from 'vitest'
import type { NoteList } from '@/shared/api/notes'
import { noteItem } from '@/test/fixtures/notes'
import { noteKindLabel, noteLocation, noteResultLink, notesReducer, noteTime, type NotesState } from './notes'

const list: NoteList = {
  companies: [
    { corpCode: '00126380', corpName: '삼성전자', items: [noteItem({ itemId: 1 }), noteItem({ itemId: 2 })] },
    { corpCode: '00164779', corpName: 'SK하이닉스', items: [noteItem({ itemId: 3, corpCode: '00164779' })] },
  ],
}
const success: NotesState = { status: 'success', data: list }

describe('notesReducer', () => {
  it('불러오는 중일 때만 응답을 받는다', () => {
    expect(notesReducer({ status: 'loading' }, { type: 'resolve', data: list })).toEqual(success)
    expect(notesReducer({ status: 'anonymous' }, { type: 'resolve', data: list })).toEqual({ status: 'anonymous' })
    expect(notesReducer({ status: 'loading' }, { type: 'reject', error: 'x' })).toEqual({ status: 'error', error: 'x' })
  })

  it('메모를 고친 항목만 바꾼다', () => {
    const next = notesReducer(success, { type: 'replace-item', item: noteItem({ itemId: 2, memo: '새 메모' }) })
    expect(next.status === 'success' && next.data.companies[0].items.map((i) => i.memo)).toEqual([null, '새 메모'])
  })

  it('항목 하나만 빼고, 기업에 남은 항목이 없으면 기업도 뺀다', () => {
    const one = notesReducer(success, { type: 'remove-item', itemId: 1 })
    expect(one.status === 'success' && one.data.companies[0].items.map((i) => i.itemId)).toEqual([2])
    const company = notesReducer(success, { type: 'remove-item', itemId: 3 })
    expect(company.status === 'success' && company.data.companies.map((c) => c.corpCode)).toEqual(['00126380'])
  })

  it('목록을 받기 전에는 항목을 바꾸지 않는다', () => {
    expect(notesReducer({ status: 'loading' }, { type: 'remove-item', itemId: 1 })).toEqual({ status: 'loading' })
  })
})

describe('noteResultLink', () => {
  it('재무 항목은 재무 수치 탭의 그 계정 근거로 간다', () => {
    expect(noteResultLink(noteItem())).toBe('/analyses/42?tab=financial&sj=IS&change=901')
  })

  it('문장 항목은 문장 변화 탭의 그 변경 근거로 간다', () => {
    const item = noteItem({ kind: 'TEXT_CHANGE', source: { ...noteItem().source, sjDiv: null, changeId: 77 } })
    expect(noteResultLink(item)).toBe('/analyses/42?tab=text&tc=77')
  })

  it('AI 답 인용은 원문 확인 탭의 그 보고서 쪽·섹션·문단으로 간다', () => {
    const source = { ...noteItem().source, sjDiv: null, changeId: null, questionId: 7, side: 'previous' as const, sectionNo: 3, blockNo: 12 }
    expect(noteResultLink(noteItem({ kind: 'ANSWER_CITATION', source }))).toBe(
      '/analyses/42?tab=source&doc=previous&section=3&block=12',
    )
    expect(noteResultLink(noteItem({ kind: 'ANSWER_CITATION', source: { ...source, blockNo: null } }))).toBe(
      '/analyses/42?tab=source&doc=previous&section=3',
    )
    expect(noteResultLink(noteItem({ kind: 'ANSWER_CITATION', source: { ...source, side: null } }))).toBeNull()
  })

  it('분석 ID가 없으면 링크를 만들지 않는다', () => {
    expect(noteResultLink(noteItem({ source: { ...noteItem().source, analysisId: null } }))).toBeNull()
  })
})

describe('표시 문구', () => {
  it('종류와 문장 변경 유형을 보인다', () => {
    expect(noteKindLabel({ kind: 'FINANCIAL_CHANGE', changeType: null })).toBe('재무 수치')
    expect(noteKindLabel({ kind: 'TEXT_CHANGE', changeType: 'DELETED' })).toBe('문장 변경 · 삭제')
  })

  it('근거 위치를 접수번호·섹션·문단으로 잇는다', () => {
    expect(noteLocation(noteItem())).toBe('접수번호 20261114001234')
    expect(noteLocation(noteItem({ source: { ...noteItem().source, sectionNo: 2, blockNo: 1 } }))).toBe(
      '접수번호 20261114001234 · 섹션 2 · 문단 1',
    )
  })

  it('담은 시각을 점으로 끊어 보인다', () => {
    expect(noteTime('2026-10-27T10:15:00')).toBe('2026.10.27 10:15')
  })
})
