import { describe, expect, it } from 'vitest'
import type { StatementSummary } from '@/shared/api/results'
import { shares } from '@/shared/lib/compare'
import { financialOverview, formatCount, textOverview, textShareSegments } from './overview'

function statement(sjDiv: StatementSummary['sjDiv'], comparable: boolean, changed: number, total = 10): StatementSummary {
  return { sjDiv, label: sjDiv, comparable, amountBasis: null, note: null, total, changed }
}

const counts = { all: 57, added: 10, deleted: 5, modified: 30, numericUpdate: 8, moved: 2, reviewNeeded: 2 }
const sections = [{ title: 'II. 사업의 내용', count: 57 }]

describe('변화 개요', () => {
  it('비교한 재무제표의 바뀐 계정 수만 더한다', () => {
    const result = financialOverview([
      statement('BS', true, 41),
      statement('IS', true, 19),
      statement('CIS', false, 7),
      statement('CF', true, 0),
      statement('SCE', false, 3),
    ])
    expect(result.changed).toBe(60)
  })

  it('비교한 재무제표가 없으면 바뀐 계정 수를 0이 아니라 null로 둔다', () => {
    expect(financialOverview([statement('BS', false, 5)]).changed).toBeNull()
    expect(financialOverview([]).changed).toBeNull()
  })

  it('비교했지만 바뀐 계정이 없으면 0이다', () => {
    expect(financialOverview([statement('BS', true, 0)])).toEqual({ changed: 0, firstChangedSjDiv: null })
  })

  it('바뀐 계정이 있는 첫 비교 재무제표를 연다', () => {
    const result = financialOverview([statement('BS', true, 0), statement('IS', false, 4), statement('CF', true, 2)])
    expect(result.firstChangedSjDiv).toBe('CF')
  })

  it('문장 비교를 끝냈으면 유형별 건수를 그대로 쓴다', () => {
    expect(textOverview({ textStatus: 'COMPLETED', counts, sections })).toEqual({ status: 'available', ...counts, partial: false, sections })
  })

  it('원문 일부를 읽지 못했으면 건수와 함께 불완전하다고 표시한다', () => {
    expect(textOverview({ textStatus: 'PARTIAL', counts, sections })).toMatchObject({ status: 'available', all: 57, partial: true })
  })

  it('문장을 비교하지 않았거나 실패했으면 건수를 쓰지 않는다', () => {
    const zero = { all: 0, added: 0, deleted: 0, modified: 0, numericUpdate: 0, moved: 0, reviewNeeded: 0 }
    expect(textOverview({ textStatus: 'FAILED', counts: zero, sections: [] })).toEqual({ status: 'unavailable' })
    expect(textOverview({ textStatus: null, counts: zero, sections: [] })).toEqual({ status: 'unavailable' })
  })

  it('건수는 천 단위로 끊고 확인하지 못한 값은 0이 아니라 확인 안 됨으로 보인다', () => {
    expect(formatCount(1234)).toBe('1,234')
    expect(formatCount(0)).toBe('0')
    expect(formatCount(null)).toBe('확인 안 됨')
  })

  it('옛 결과(m2-8, 숫자만 바뀜·위치 이동 0)의 비율 막대는 전처럼 추가·수정·삭제 세 칸이다', () => {
    const segments = textShareSegments({ added: 10, modified: 30, deleted: 0, numericUpdate: 0, moved: 0 })
    expect(segments).toEqual([
      { label: '추가', value: 10, text: '10', tone: 'added' },
      { label: '수정', value: 30, text: '30', tone: 'modified' },
      { label: '삭제', value: 0, text: '0', tone: 'deleted' },
    ])
  })

  it('새 결과(m2-9)는 숫자만 바뀜·위치 이동을 중립색 칸으로 더하고 비율 합이 전체의 100%다', () => {
    // 분석 16: 전체 1,053 = 추가 267 + 수정 427 + 삭제 142 + 숫자만 바뀜 215 + 위치 이동 2 (검토 필요 0)
    const segments = textShareSegments({ added: 267, modified: 427, deleted: 142, numericUpdate: 215, moved: 2 })
    expect(segments.map((s) => [s.label, s.text, s.tone])).toEqual([
      ['추가', '267', 'added'],
      ['수정', '427', 'modified'],
      ['삭제', '142', 'deleted'],
      ['숫자만 바뀜', '215', 'neutral'],
      ['위치 이동', '2', 'neutral'],
    ])
    const percents = shares(segments.map((s) => s.value))
    expect(percents.reduce((sum, p) => sum + p, 0)).toBeCloseTo(100)
    expect(percents[0]).toBeCloseTo((267 / 1053) * 100)
  })

  it('비율의 분모는 짝지은 변경 전부(전체 − 검토 필요)이고 검토 필요는 막대에 넣지 않는다', () => {
    const segments = textShareSegments(counts)
    expect(segments.reduce((sum, s) => sum + s.value, 0)).toBe(counts.all - counts.reviewNeeded)
    expect(segments.map((s) => s.label)).not.toContain('검토 필요')
  })

  it('숫자만 바뀜과 위치 이동은 0인 쪽만 뺀다', () => {
    const segments = textShareSegments({ added: 1, modified: 1, deleted: 1, numericUpdate: 0, moved: 3 })
    expect(segments.map((s) => s.label)).toEqual(['추가', '수정', '삭제', '위치 이동'])
  })
})
