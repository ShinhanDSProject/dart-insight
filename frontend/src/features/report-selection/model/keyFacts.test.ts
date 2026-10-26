import { describe, expect, it } from 'vitest'
import type { Dividend, KeyFactChange, MajorShareholder } from '@/shared/api/keyFacts'
import { changeLine, changeMark, pairDividends, pairShareholders, sectionView } from './keyFacts'

function change(partial: Partial<KeyFactChange>): KeyFactChange {
  return { type: 'CHANGED', name: '이재용', stockKind: '보통주', field: 'endRatio', before: null, after: null, ...partial }
}

function holder(name: string, stockKind: string, endRatio: string | null): MajorShareholder {
  return {
    name,
    relation: null,
    stockKind,
    beginShares: null,
    beginRatio: null,
    endShares: null,
    endRatio,
    remark: null,
  }
}

function dividend(category: string, stockKind: string | null, currentTerm: string | null): Dividend {
  return { category, stockKind, currentTerm, priorTerm: null, twoTermsAgo: null }
}

describe('바뀐 항목 한 줄', () => {
  it('최대주주 지분율 변화를 원문 값 그대로 적는다', () => {
    expect(changeLine('majorShareholders', change({ before: '1.65', after: '1.67' }))).toBe(
      '이재용(보통주) 지분 1.65% → 1.67%',
    )
  })

  it('지분율이 같고 주식 수만 바뀌면 주식 수를 적는다', () => {
    expect(
      changeLine('majorShareholders', change({ name: '송재혁', field: 'endShares', before: '9,300', after: '0' })),
    ).toBe('송재혁(보통주) 주식 수 9,300주 → 0주')
  })

  it('새로 들어오거나 빠진 주주를 적는다', () => {
    expect(changeLine('majorShareholders', change({ type: 'ADDED', name: '김용관', after: '0.00' }))).toBe(
      '김용관(보통주) 새로 포함 · 지분 0.00%',
    )
    expect(changeLine('majorShareholders', change({ type: 'REMOVED', name: '한종희', before: '0.00' }))).toBe(
      '한종희(보통주) 목록에서 빠짐 · 이전 지분 0.00%',
    )
  })

  it('임원의 새 선임·빠짐·직위·등기 구분 변화를 적는다', () => {
    const exec = (partial: Partial<KeyFactChange>) => change({ stockKind: null, field: 'position', ...partial })
    expect(changeLine('executives', exec({ type: 'ADDED', name: '김용관', after: '사장' }))).toBe('새 임원: 김용관(사장)')
    expect(changeLine('executives', exec({ type: 'REMOVED', name: '송재혁', before: '사장' }))).toBe(
      '빠진 임원: 송재혁(사장)',
    )
    expect(changeLine('executives', exec({ type: 'ADDED', name: '홍길동', after: null }))).toBe('새 임원: 홍길동')
    expect(changeLine('executives', exec({ name: '노태문', before: '사장', after: '부회장' }))).toBe(
      '노태문 직위 사장 → 부회장',
    )
    expect(
      changeLine('executives', exec({ name: '신제윤', field: 'registeredType', before: '사외이사', after: '독립이사' })),
    ).toBe('신제윤 등기 구분 사외이사 → 독립이사')
  })

  it('주당 현금배당금 변화를 구분 원문과 함께 적고, 없는 값은 없음으로 적는다', () => {
    const div = change({ name: '주당 현금배당금(원)', field: 'currentTerm', before: '732', after: '746' })
    expect(changeLine('dividends', div)).toBe('주당 현금배당금(원)(보통주) 732 → 746')
    expect(changeLine('dividends', { ...div, before: null })).toBe('주당 현금배당금(원)(보통주) 없음 → 746')
  })

  it('바뀐 종류를 기호와 글자로 함께 표시한다', () => {
    expect(changeMark('ADDED')).toEqual({ symbol: '+', label: '추가' })
    expect(changeMark('REMOVED')).toEqual({ symbol: '−', label: '빠짐' })
    expect(changeMark('CHANGED')).toEqual({ symbol: '→', label: '바뀜' })
  })
})

describe('두 보고서 나란히 놓기', () => {
  it('최대주주를 성명과 주식 종류로 짝지어 현재 순서, 그다음 빠진 주주 순서로 놓는다', () => {
    const rows = pairShareholders(
      [holder('홍라희', '보통주', '1.66'), holder('한종희', '보통주', '0.00'), holder('이재용', '보통주', '1.65')],
      [holder('이재용', '보통주', '1.67'), holder('이재용', '우선주', '0.02'), holder('홍라희', '보통주', '1.66')],
    )
    expect(rows.map((r) => [r.name, r.stockKind, r.before, r.after, r.changed])).toEqual([
      ['이재용', '보통주', '1.65', '1.67', true],
      ['이재용', '우선주', null, '0.02', true],
      ['홍라희', '보통주', '1.66', '1.66', false],
      ['한종희', '보통주', '0.00', null, true],
    ])
  })

  it('배당은 각 보고서의 당기 값을 놓고, 둘 다 없는 값이면 바뀌지 않은 것으로 본다', () => {
    const rows = pairDividends(
      [dividend('주당 현금배당금(원)', '보통주', '732'), dividend('주식배당금총액(백만원)', null, null)],
      [dividend('주당 현금배당금(원)', '보통주', '746'), dividend('주식배당금총액(백만원)', null, null)],
    )
    expect(rows.map((r) => [r.name, r.before, r.after, r.changed])).toEqual([
      ['주당 현금배당금(원)', '732', '746', true],
      ['주식배당금총액(백만원)', null, null, false],
    ])
  })
})

describe('묶음 상태', () => {
  it('보고서 없음·자료 없음·받지 못함·자료 있음을 나눈다', () => {
    expect(sectionView(null)).toEqual({ kind: 'no-report' })
    expect(sectionView({ rceptNo: '1', status: 'NO_DATA', settlementDate: null, rows: [] })).toEqual({ kind: 'no-data' })
    expect(sectionView({ rceptNo: '1', status: 'UNAVAILABLE', settlementDate: null, rows: [] })).toEqual({
      kind: 'unavailable',
    })
    expect(sectionView({ rceptNo: '1', status: 'AVAILABLE', settlementDate: '2026-06-30', rows: [1] })).toEqual({
      kind: 'available',
      rows: [1],
      settlementDate: '2026-06-30',
    })
  })
})
