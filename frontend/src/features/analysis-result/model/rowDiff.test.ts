import { describe, expect, it } from 'vitest'
import type { ComparedRowDiff, TextRowDiff } from '@/shared/api/textChanges'
import { cardTypeLabel, cellText, comparedRowsOf, hiddenChangedRows, isNotCompared, rowCountItems, visibleChangedRows } from './rowDiff'

const row = (key: string) => ({ key, cells: [{ column: '진행상황', previous: '진행 중', current: '화해권고결정' }] })
const compared: ComparedRowDiff = {
  status: 'COMPARED',
  keyColumn: '사건의 명칭(사건번호)',
  counts: { changed: 2, added: 3, missing: 11, same: 1 },
  pairedPrevious: { rceptNo: '20260813001718', sectionNo: 40, blockNo: 2028 },
  changedRows: [row('2025가합9085'), row('2025마6793')],
}
const notCompared: TextRowDiff = { status: 'NOT_COMPARED', keyColumn: null, counts: null, pairedPrevious: null, changedRows: [] }

describe('rowCountItems', () => {
  it("바뀜·새로·이번엔 없음·그대로 순서로 0건도 함께 돌려주고 '사라짐'이라고 쓰지 않는다(AC7)", () => {
    const items = rowCountItems({ changed: 2, added: 0, missing: 11, same: 1 })
    expect(items).toEqual([
      { label: '바뀜', count: 2 },
      { label: '새로', count: 0 },
      { label: '이번엔 없음', count: 11 },
      { label: '그대로', count: 1 },
    ])
    expect(JSON.stringify(items)).not.toContain('사라짐')
  })
})

describe('comparedRowsOf·isNotCompared', () => {
  it('행을 비교한 표만 비교 결과를 돌려준다', () => {
    expect(comparedRowsOf(compared)).toBe(compared)
    expect(comparedRowsOf(notCompared)).toBeNull()
    expect(comparedRowsOf(null)).toBeNull()
  })

  it('행 비교를 하지 않은 표를 문단·옛 분석(null)과 구분한다(AC8)', () => {
    expect(isNotCompared(notCompared)).toBe(true)
    expect(isNotCompared(compared)).toBe(false)
    expect(isNotCompared(null)).toBe(false)
  })
})

describe('visibleChangedRows·hiddenChangedRows', () => {
  const many: ComparedRowDiff = {
    ...compared,
    counts: { changed: 5, added: 0, missing: 0, same: 0 },
    changedRows: ['A', 'B', 'C', 'D', 'E'].map(row),
  }

  it('카드에는 바뀐 행을 3개까지만 보이고 나머지 수를 알린다', () => {
    expect(visibleChangedRows(many).map((r) => r.key)).toEqual(['A', 'B', 'C'])
    expect(hiddenChangedRows(many)).toBe(2)
  })

  it('목록이 3개만 줘도 건수로 나머지 수를 낸다', () => {
    const fromList = { ...many, changedRows: many.changedRows.slice(0, 3) }
    expect(hiddenChangedRows(fromList)).toBe(2)
  })

  it('모두 보이면 나머지는 0이다', () => {
    expect(hiddenChangedRows(compared)).toBe(0)
  })
})

describe('cardTypeLabel', () => {
  it('구성이 바뀌어 짝지은 표는 추가가 아니라 표 구성이 바뀐 것으로 보인다', () => {
    expect(cardTypeLabel({ changeType: 'ADDED', listGroup: 'MAIN', rowDiff: compared })).toBe('표 구성 바뀜')
  })

  it('새 표와 짝지어 접은 이전 표는 삭제가 아니라 이전 표로 보인다', () => {
    expect(cardTypeLabel({ changeType: 'DELETED', listGroup: 'PAIRED_TABLE', rowDiff: null })).toBe('표 구성 바뀜(이전 표)')
  })

  it('그 밖에는 변경 유형 이름 그대로다', () => {
    expect(cardTypeLabel({ changeType: 'ADDED', listGroup: 'MAIN', rowDiff: null })).toBe('추가')
    expect(cardTypeLabel({ changeType: 'DELETED', listGroup: 'MAIN', rowDiff: null })).toBe('삭제')
    expect(cardTypeLabel({ changeType: 'DELETED', listGroup: null, rowDiff: null })).toBe('삭제')
    expect(cardTypeLabel({ changeType: 'MODIFIED', listGroup: 'MAIN', rowDiff: { ...compared, pairedPrevious: null } })).toBe('수정')
    expect(cardTypeLabel({ changeType: 'MODIFIED', listGroup: 'MAIN', rowDiff: notCompared })).toBe('수정')
  })
})

describe('cellText', () => {
  it('빈 칸은 빈 칸이라고 보이고 값은 그대로 둔다', () => {
    expect(cellText('  ')).toBe('(빈 칸)')
    expect(cellText('70.0')).toBe('70.0')
  })
})
