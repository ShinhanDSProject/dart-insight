import { describe, expect, it } from 'vitest'
import type { TableCell } from '@/shared/api/textChanges'
import { rowStatusBadgeLabel, tableDiff, tableDiffSummaryLabel } from './tableDiff'

function toTable(rows: string[][], headerRows = 1): TableCell[][] {
  return rows.map((row, r) =>
    row.map((text, c) => ({
      text,
      header: r < headerRows || c === 0,
      colspan: 1,
      rowspan: 1,
    })),
  )
}

describe('원문 비교 표 셀·행 변경 탐지(#524)', () => {
  it('행 머리글 기준으로 짝지어 바뀐 셀과 추가·삭제된 행을 구분한다', () => {
    const previous = toTable([
      ['구분', '기말 잔액', '비고'],
      ['단기차입금', '10,000', '운전자금'],
      ['유동성장기부채', '5,000', '상환 예정'],
      ['합계', '15,000', '-'],
    ])
    const current = toTable([
      ['구분', '기말 잔액', '비고'],
      ['단기차입금', '12,000', '운전자금'],
      ['사채', '8,000', '신규 발행'],
      ['합계', '20,000', '-'],
    ])

    const diff = tableDiff(previous, current)!
    expect(diff.changedCells).toBe(2)
    expect(diff.removedRows).toBe(1)
    expect(diff.addedRows).toBe(1)

    // 단기차입금 행의 기말 잔액(1번 열)만 변경
    expect(diff.previous.rows[1]).toEqual({ status: 'matched', changedCols: new Set([1]) })
    expect(diff.current.rows[1]).toEqual({ status: 'matched', changedCols: new Set([1]) })

    // 유동성장기부채는 삭제 행, 사채는 추가 행
    expect(rowStatusBadgeLabel(diff.previous.rows[2])).toBe('삭제 행')
    expect(rowStatusBadgeLabel(diff.current.rows[2])).toBe('추가 행')

    // 합계 행의 기말 잔액(1번 열) 변경
    expect(diff.previous.rows[3]).toEqual({ status: 'matched', changedCols: new Set([1]) })
    expect(diff.current.rows[3]).toEqual({ status: 'matched', changedCols: new Set([1]) })

    expect(tableDiffSummaryLabel(diff)).toBe('바뀐 표 칸 2곳 · 추가된 행 1줄 · 삭제된 행 1줄을 표시했어요.')
  })

  it('행 머리글이 하나도 맞지 않는 표는 같은 행 순번끼리 비교한다', () => {
    const previous = toTable([['2024년 100명', '본사']], 0)
    const current = toTable([['2025년 120명', '본사']], 0)

    const diff = tableDiff(previous, current)!
    expect(diff.changedCells).toBe(1)
    expect(diff.addedRows).toBe(0)
    expect(diff.removedRows).toBe(0)
    expect(tableDiffSummaryLabel(diff)).toBe('바뀐 표 칸 1곳을 표시했어요.')
  })

  it('모든 칸이 같으면 요약 문구는 null을 돌려준다', () => {
    const same = toTable([
      ['구분', '금액'],
      ['매출액', '100'],
    ])
    const diff = tableDiff(same, same)!
    expect(diff.changedCells).toBe(0)
    expect(tableDiffSummaryLabel(diff)).toBeNull()
  })
})
