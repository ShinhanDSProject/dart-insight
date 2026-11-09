import { describe, expect, it } from 'vitest'
import type { TextListGroup } from '@/shared/api/textChanges'
import { defaultListNote, foldedGroups, foldedTotal, listGroupsOf, noteScopeLabel } from './textGroups'

const none = { type: null, section: null, q: null, risk: false, field: null }
const groupCounts: Record<TextListGroup, number> = { MAIN: 606, HEADING: 94, FORMATTING: 23, PERIOD: 90, MOVED: 7, NOTE: 428, PAIRED_TABLE: 5, UNPAIRED: 2 }

describe('listGroupsOf', () => {
  it('거르기가 없으면 기본 목록(MAIN, UNPAIRED)을 부른다', () => {
    expect(listGroupsOf(none)).toEqual(['MAIN', 'UNPAIRED'])
  })

  it('검색·유형·섹션·위험 관련으로 거르면 접힌 변경도 찾도록 묶음을 보내지 않는다(AC6)', () => {
    expect(listGroupsOf({ ...none, q: '소송' })).toEqual([])
    expect(listGroupsOf({ ...none, type: 'ADDED' })).toEqual([])
    expect(listGroupsOf({ ...none, section: 'II. 사업의 내용' })).toEqual([])
    expect(listGroupsOf({ ...none, risk: true })).toEqual([])
  })

  it('분야로 거르면 묶음을 보내지 않는다(분야는 MAIN에만 있다)', () => {
    expect(listGroupsOf({ ...none, field: 'AUDIT' })).toEqual([])
  })
})

describe('foldedGroups', () => {
  it('접는 묶음을 주석부터 정해진 순서로 건수와 함께 돌려주고 MAIN·UNPAIRED는 뺀다', () => {
    expect(foldedGroups(groupCounts).map((g) => [g.group, g.count])).toEqual([
      ['NOTE', 428],
      ['HEADING', 94],
      ['FORMATTING', 23],
      ['PERIOD', 90],
      ['MOVED', 7],
      ['PAIRED_TABLE', 5],
    ])
  })

  it('0건인 묶음은 보이지 않는다', () => {
    expect(foldedGroups({ ...groupCounts, MOVED: 0 }).map((g) => g.group)).not.toContain('MOVED')
    expect(foldedGroups({ ...groupCounts, PERIOD: 0 }).map((g) => g.group)).not.toContain('PERIOD')
  })

  it("기간 표시만 바뀐 글은 '기수·기준일만 바뀐 글'로 접는다(3.57)", () => {
    expect(foldedGroups(groupCounts).find((g) => g.group === 'PERIOD')?.label).toBe('기수·기준일만 바뀐 글')
  })

  it('접은 변경의 합을 낸다', () => {
    expect(foldedTotal(groupCounts)).toBe(647)
  })
})

describe('defaultListNote', () => {
  it('짝을 정하지 못한 항목이 있으면 기본 목록 건수와 따로 알린다(AC9)', () => {
    expect(defaultListNote(groupCounts)).toBe('기본 목록 606건 · 짝을 정하지 못한 항목 2건(분야와 기본 목록 건수에는 세지 않아요)')
  })

  it('없으면 기본 목록 건수만 알린다', () => {
    expect(defaultListNote({ ...groupCounts, UNPAIRED: 0 })).toBe('기본 목록 606건')
  })
})

describe('noteScopeLabel', () => {
  it('연결·별도 주석을 이름으로 돌려주고 구분할 수 없거나 주석이 아니면 null이다', () => {
    expect(noteScopeLabel('CONSOLIDATED')).toBe('연결 주석')
    expect(noteScopeLabel('SEPARATE')).toBe('별도 주석')
    expect(noteScopeLabel('UNKNOWN')).toBeNull()
    expect(noteScopeLabel(null)).toBeNull()
  })
})
