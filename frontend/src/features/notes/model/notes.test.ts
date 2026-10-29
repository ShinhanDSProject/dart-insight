import { describe, expect, it } from 'vitest'
import type { NoteList } from '@/shared/api/notes'
import { companyNote, noteItem } from '@/test/fixtures/notes'
import {
  companyOverviewLink,
  disclosureGroupLabel,
  FOLLOWUP_NOTICE,
  hasCompanyFollowups,
  newerAnalysisLink,
  noteKindLabel,
  noteLocation,
  noteResultLink,
  notesReducer,
  noteTime,
  type NotesState,
} from './notes'

const list: NoteList = {
  companies: [
    companyNote({ corpCode: '00126380', corpName: '삼성전자', items: [noteItem({ itemId: 1 }), noteItem({ itemId: 2 })] }),
    companyNote({ corpCode: '00164779', corpName: 'SK하이닉스', items: [noteItem({ itemId: 3, corpCode: '00164779' })] }),
  ],
}
const success: NotesState = { status: 'success', data: list }

describe('notesReducer', () => {
  it('불러오는 중일 때만 응답을 받는다', () => {
    expect(notesReducer({ status: 'loading' }, { type: 'resolve', data: list })).toEqual(success)
    expect(notesReducer({ status: 'anonymous' }, { type: 'resolve', data: list })).toEqual({ status: 'anonymous' })
    expect(notesReducer({ status: 'loading' }, { type: 'reject', error: 'x' })).toEqual({ status: 'error', error: 'x' })
  })

  it('메모를 고친 항목만 관련 후속 공시와 함께 바꾼다', () => {
    const related = [
      {
        rceptNo: '20261201000001',
        reportName: '단일판매·공급계약체결',
        rceptDt: '2026-12-01',
        matchLabel: "메모 '공급계약'",
        dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261201000001',
      },
    ]
    const next = notesReducer(success, {
      type: 'replace-item',
      item: noteItem({ itemId: 2, memo: '공급계약 확인', relatedDisclosures: related }),
    })
    expect(next.status === 'success' && next.data.companies[0].items.map((i) => i.memo)).toEqual([null, '공급계약 확인'])
    expect(next.status === 'success' && next.data.companies[0].items[1].relatedDisclosures).toEqual(related)
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

describe('후속 분석·공시 연결(#504)', () => {
  it('기업 개요와 후속 분석 결과 주소를 만든다', () => {
    expect(companyOverviewLink('00126380')).toBe('/companies/00126380')
    expect(newerAnalysisLink(108)).toBe('/analyses/108')
  })

  it('후속 분석이나 이후 공시가 하나라도 있을 때만 소식 구역을 연다', () => {
    expect(hasCompanyFollowups({ newerAnalyses: [], newerDisclosures: [] })).toBe(false)
    expect(
      hasCompanyFollowups({
        newerAnalyses: [
          {
            analysisId: 108,
            basis: 'YOY',
            previousReportName: '사업보고서 (2025.12)',
            currentRceptNo: '20270330000111',
            currentReportName: '사업보고서 (2026.12)',
          },
        ],
        newerDisclosures: [],
      }),
    ).toBe(true)
    expect(
      hasCompanyFollowups({
        newerAnalyses: [],
        newerDisclosures: [
          {
            rceptNo: '20261201000001',
            reportName: '단일판매·공급계약체결',
            rceptDt: '2026-12-01',
            disclosureGroup: 'BUSINESS',
            dartUrl: 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20261201000001',
          },
        ],
      }),
    ).toBe(true)
  })

  it('공시 분류 코드를 한국어 이름으로 바꾼다', () => {
    expect(disclosureGroupLabel('PERIODIC')).toBe('정기보고서')
    expect(disclosureGroupLabel('OWNERSHIP')).toBe('지분 변동')
    expect(disclosureGroupLabel('FUNDING')).toBe('자금 조달')
    expect(disclosureGroupLabel('GOVERNANCE')).toBe('지배구조')
    expect(disclosureGroupLabel('BUSINESS')).toBe('실적·영업')
    expect(disclosureGroupLabel('OTHER')).toBe('기타')
  })

  it('인과관계 오해를 막는 고정 안내 문구를 둔다', () => {
    expect(FOLLOWUP_NOTICE).toBe('같은 기업에서 이후에 공시된 내역이며 인과관계를 뜻하지 않아요.')
  })
})
