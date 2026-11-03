import { describe, expect, it } from 'vitest'
import type { StatementSummary } from '@/shared/api/results'
import type { PriorityLevel, TextChangeItem } from '@/shared/api/textChanges'
import { financialOverview, formatCount, highPriorityCount, textOverview } from './overview'

function change(level: PriorityLevel | null): TextChangeItem {
  return { priority: level === null ? null : { level, score: null, reasons: [] } } as TextChangeItem
}

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
    expect(textOverview({ textStatus: 'COMPLETED', counts, sections, totalItems: 57, items: [] })).toEqual({
      status: 'available',
      ...counts,
      partial: false,
      sections,
      high: null,
    })
  })

  it('원문 일부를 읽지 못했으면 건수와 함께 불완전하다고 표시한다', () => {
    expect(textOverview({ textStatus: 'PARTIAL', counts, sections, totalItems: 0, items: [] })).toMatchObject({ status: 'available', all: 57, partial: true })
  })

  it('문장을 비교하지 않았거나 실패했으면 건수를 쓰지 않는다', () => {
    const zero = { all: 0, added: 0, deleted: 0, modified: 0, numericUpdate: 0, moved: 0, reviewNeeded: 0 }
    expect(textOverview({ textStatus: 'FAILED', counts: zero, sections: [], totalItems: 0, items: [] })).toEqual({ status: 'unavailable' })
    expect(textOverview({ textStatus: null, counts: zero, sections: [], totalItems: 0, items: [] })).toEqual({ status: 'unavailable' })
  })

  it('받은 쪽이 전체를 담았으면 높음 변경 수를 그대로 센다', () => {
    expect(highPriorityCount({ totalItems: 3, items: [change('HIGH'), change('HIGH'), change('LOW')] })).toBe(2)
    expect(highPriorityCount({ totalItems: 2, items: [change('HIGH'), change('HIGH')] })).toBe(2)
    expect(highPriorityCount({ totalItems: 0, items: [] })).toBe(0)
  })

  it('뒤에 더 있어도 첫 쪽 마지막이 높음이 아니면 높음은 모두 받은 것이다', () => {
    expect(highPriorityCount({ totalItems: 300, items: [change('HIGH'), change('MEDIUM'), change(null)] })).toBe(1)
  })

  it('첫 쪽이 모두 높음인데 뒤에 더 있으면 셀 수 없어 null이다', () => {
    expect(highPriorityCount({ totalItems: 300, items: [change('HIGH'), change('HIGH')] })).toBeNull()
  })

  it('개요에 먼저 볼 것(높음) 수를 함께 둔다', () => {
    const items = [change('HIGH'), change('MEDIUM')]
    expect(textOverview({ textStatus: 'COMPLETED', counts, sections, totalItems: 57, items })).toMatchObject({ high: 1 })
  })

  it('건수는 천 단위로 끊고 확인하지 못한 값은 0이 아니라 확인 안 됨으로 보인다', () => {
    expect(formatCount(1234)).toBe('1,234')
    expect(formatCount(0)).toBe('0')
    expect(formatCount(null)).toBe('확인 안 됨')
  })
})
