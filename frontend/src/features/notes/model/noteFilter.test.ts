import { describe, expect, it } from 'vitest'
import { companyNote, noteItem } from '@/test/fixtures/notes'
import {
  countNotes,
  filterCompanyNotes,
  INITIAL_NOTE_FILTER,
  isNoteFilterActive,
  noteFilterReducer,
  noteFilterSummary,
} from './noteFilter'

const financial = noteItem({
  itemId: 1,
  corpCode: '00126380',
  kind: 'FINANCIAL_CHANGE',
  label: '손익계산서 · 매출액',
  text: '145조 원 → 152조 원 (+4.8%)',
  memo: null,
  source: { ...noteItem().source, rceptNo: '20261114001234' },
})

const text = noteItem({
  itemId: 2,
  corpCode: '00126380',
  kind: 'TEXT_CHANGE',
  label: 'II. 사업의 내용 > 1. 사업의 개요',
  text: '당사는 HBM과 파운드리 사업을 영위합니다.',
  changeType: 'MODIFIED',
  memo: 'HBM 비중 확인',
  source: { ...noteItem().source, sjDiv: null, changeId: 77, rceptNo: '20261114001234' },
})

const citation = noteItem({
  itemId: 3,
  corpCode: '00164779',
  kind: 'ANSWER_CITATION',
  label: 'III. 재무에 관한 사항',
  text: '설비투자가 전년 대비 늘었습니다.',
  question: '설비투자는 왜 늘었나요?',
  memo: '   ',
  source: { ...noteItem().source, sjDiv: null, changeId: null, questionId: 5, side: 'current', sectionNo: 3, blockNo: 4, rceptNo: '20261115009999' },
})

const companies = [
  companyNote({ corpCode: '00126380', corpName: '삼성전자', items: [financial, text] }),
  companyNote({ corpCode: '00164779', corpName: 'SK하이닉스', items: [citation] }),
]

describe('내 판단 노트 거르기(#535)', () => {
  it('전체·유형별·공백 아닌 메모 건수를 정확히 센다', () => {
    expect(countNotes(companies)).toEqual({
      total: 3,
      byKind: {
        FINANCIAL_CHANGE: 1,
        TEXT_CHANGE: 1,
        ANSWER_CITATION: 1,
      },
      memo: 1,
    })
  })

  it('noteFilterReducer가 검색어·유형·메모 여부·초기화를 전이한다', () => {
    let state = noteFilterReducer(INITIAL_NOTE_FILTER, { type: 'set-query', query: 'hbm' })
    state = noteFilterReducer(state, { type: 'set-kind', kind: 'TEXT_CHANGE' })
    state = noteFilterReducer(state, { type: 'toggle-memo-only' })
    expect(state).toEqual({ query: 'hbm', kind: 'TEXT_CHANGE', memoOnly: true })
    expect(isNoteFilterActive(state)).toBe(true)

    const reset = noteFilterReducer(state, { type: 'reset' })
    expect(reset).toEqual(INITIAL_NOTE_FILTER)
    expect(isNoteFilterActive(reset)).toBe(false)
  })

  it('기업명·고유번호·항목명·본문·질문·메모·접수번호를 대소문자 무시 부분 일치로 찾고 빈 기업은 뺀다', () => {
    expect(
      filterCompanyNotes(companies, { ...INITIAL_NOTE_FILTER, query: 'sk하이닉스' }).map((c) => c.corpCode),
    ).toEqual(['00164779'])

    expect(
      filterCompanyNotes(companies, { ...INITIAL_NOTE_FILTER, query: '00126380' })[0]?.items.map((i) => i.itemId),
    ).toEqual([1, 2])

    expect(
      filterCompanyNotes(companies, { ...INITIAL_NOTE_FILTER, query: 'hbm' })[0]?.items.map((i) => i.itemId),
    ).toEqual([2])

    expect(
      filterCompanyNotes(companies, { ...INITIAL_NOTE_FILTER, query: '설비투자는 왜' })[0]?.items.map((i) => i.itemId),
    ).toEqual([3])

    expect(
      filterCompanyNotes(companies, { ...INITIAL_NOTE_FILTER, query: '20261115009999' })[0]?.items.map((i) => i.itemId),
    ).toEqual([3])

    expect(filterCompanyNotes(companies, { ...INITIAL_NOTE_FILTER, query: '없는단어' })).toEqual([])
  })

  it('유형과 메모 있음 조건을 함께 적용한다', () => {
    expect(
      filterCompanyNotes(companies, { query: '', kind: 'ANSWER_CITATION', memoOnly: false }).map((c) => c.corpCode),
    ).toEqual(['00164779'])

    expect(
      filterCompanyNotes(companies, { query: '', kind: 'ALL', memoOnly: true })[0]?.items.map((i) => i.itemId),
    ).toEqual([2])

    expect(filterCompanyNotes(companies, { query: '', kind: 'FINANCIAL_CHANGE', memoOnly: true })).toEqual([])
  })

  it('필터 활성 여부에 맞춰 전체·일치 기업과 건수 문구를 만든다', () => {
    expect(noteFilterSummary(2, 3, companies, false)).toBe('전체 2개 기업 · 3건')
    const matched = filterCompanyNotes(companies, { ...INITIAL_NOTE_FILTER, memoOnly: true })
    expect(noteFilterSummary(2, 3, matched, true)).toBe('일치 1개 기업 · 1건 (전체 3건)')
  })
})
