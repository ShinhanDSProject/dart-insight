import { describe, expect, it } from 'vitest'
import {
  normalizeSectionText,
  SECTION_COMBO_CLOSED,
  sectionComboReducer,
  sectionSuggestions,
} from './sectionSuggestions'

const titles = [
  '(목차 밖 본문)',
  'I. 회사의 개요',
  'II. 사업의 내용',
  'III. 재무에 관한 사항',
  'VII. 주주에 관한 사항',
  'XI. 그 밖에 투자자 보호를 위하여 필요한 사항',
]

describe('normalizeSectionText', () => {
  it('앞 번호·따옴표·공백을 빼고 소문자로 바꾼다', () => {
    expect(normalizeSectionText("XI. 그 밖에 '투자자' 보호")).toBe('그밖에투자자보호')
    expect(normalizeSectionText('7. 기타 참고사항')).toBe('기타참고사항')
    expect(normalizeSectionText('가. ESG 현황')).toBe('esg현황')
    expect(normalizeSectionText('(1) 위험관리')).toBe('위험관리')
  })
})

describe('sectionSuggestions', () => {
  it('입력이 든 섹션 제목을 제안한다', () => {
    expect(sectionSuggestions(titles, '투자자')).toEqual(['XI. 그 밖에 투자자 보호를 위하여 필요한 사항'])
  })

  it('띄어쓰기·번호가 달라도 맞춘다', () => {
    expect(sectionSuggestions(titles, '사업의내용')).toEqual(['II. 사업의 내용'])
    expect(sectionSuggestions(titles, '2. 사업 의 내용')).toEqual(['II. 사업의 내용'])
  })

  it('입력의 마지막 낱말이 든 제목도 제안한다', () => {
    expect(sectionSuggestions(titles, '이번에 바뀐 사업의')).toEqual(['II. 사업의 내용'])
  })

  it('맞는 섹션이 없으면 빈 목록이다', () => {
    expect(sectionSuggestions(titles, '배당금')).toEqual([])
  })

  it('공백을 뺀 입력이 2자보다 짧으면 제안하지 않는다', () => {
    expect(sectionSuggestions(titles, ' 사 ')).toEqual([])
    expect(sectionSuggestions(titles, '')).toEqual([])
  })

  it('목차 밖 본문은 제안하지 않는다', () => {
    expect(sectionSuggestions(titles, '본문')).toEqual([])
    expect(sectionSuggestions(titles, '목차')).toEqual([])
  })

  it('짧은 제목을 먼저 두고 같은 제목은 한 번만, 최대 5개까지 제안한다', () => {
    const many = ['가. 사항 하나 길게', '나. 사항', '나. 사항', '다. 사항 셋', '라. 사항 넷넷', '마. 사항 다섯다섯', '바. 사항 여섯여섯여섯']
    expect(sectionSuggestions(many, '사항')).toEqual(['나. 사항', '다. 사항 셋', '라. 사항 넷넷', '마. 사항 다섯다섯', '가. 사항 하나 길게'])
  })

  it('최상위 제목을 하위 경로보다 먼저 둔다', () => {
    expect(sectionSuggestions(['II. 사업의 내용 > 1. 개요', 'I. 회사의 개요와 사업 현황'], '개요')).toEqual([
      'I. 회사의 개요와 사업 현황',
      'II. 사업의 내용 > 1. 개요',
    ])
  })
})

describe('sectionComboReducer', () => {
  it('입력하면 고른 줄 없이 연다', () => {
    expect(sectionComboReducer(SECTION_COMBO_CLOSED, { type: 'input' })).toEqual({ status: 'open', active: null })
  })

  it('↓는 첫 줄부터, ↑는 마지막 줄부터 고르고 끝에서 돌아간다', () => {
    const open = { status: 'open', active: null } as const
    expect(sectionComboReducer(open, { type: 'move', delta: 1, count: 3 })).toEqual({ status: 'open', active: 0 })
    expect(sectionComboReducer(open, { type: 'move', delta: -1, count: 3 })).toEqual({ status: 'open', active: 2 })
    expect(sectionComboReducer({ status: 'open', active: 2 }, { type: 'move', delta: 1, count: 3 })).toEqual({ status: 'open', active: 0 })
    expect(sectionComboReducer({ status: 'open', active: 0 }, { type: 'move', delta: -1, count: 3 })).toEqual({ status: 'open', active: 2 })
  })

  it('닫힌 채 ↓를 누르면 다시 열어 첫 줄을 고른다', () => {
    expect(sectionComboReducer(SECTION_COMBO_CLOSED, { type: 'move', delta: 1, count: 2 })).toEqual({ status: 'open', active: 0 })
  })

  it('제안이 없으면 옮기지 않는다', () => {
    expect(sectionComboReducer(SECTION_COMBO_CLOSED, { type: 'move', delta: 1, count: 0 })).toBe(SECTION_COMBO_CLOSED)
  })

  it('닫으면 고른 줄도 지운다', () => {
    expect(sectionComboReducer({ status: 'open', active: 1 }, { type: 'close' })).toEqual(SECTION_COMBO_CLOSED)
  })
})
