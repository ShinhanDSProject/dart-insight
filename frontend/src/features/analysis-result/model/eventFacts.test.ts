import { describe, expect, it } from 'vitest'
import type { TextEventFact } from '@/shared/api/textEvents'
import { factsView } from './eventFacts'

const fact = (overrides: Partial<TextEventFact> = {}): TextEventFact => ({
  accountType: null,
  changeId: 905,
  sjDiv: 'BS',
  accountName: '자기주식',
  previousAmount: 1_200_000_000,
  currentAmount: 3_450_000_000,
  changeAmount: 2_250_000_000,
  changeRate: 1.875,
  calcStatus: 'OK',
  currency: 'KRW',
  ...overrides,
})

describe('factsView', () => {
  it('재무 수치 탭과 같은 기본 단위·같은 표기로 이전·이번·증감·증감률을 적는다', () => {
    expect(factsView([fact()])).toEqual({
      unit: '백만원',
      rows: [{ changeId: 905, account: '자기주식', previous: '1,200', current: '3,450', change: '▲ 2,250', rate: '+187.5%' }],
    })
  })

  it('투자 유형이 있으면 계정 이름 앞에 붙인다', () => {
    expect(factsView([fact({ accountType: '시설 투자', accountName: '건설중인자산' })])?.rows[0].account).toBe('시설 투자 · 건설중인자산')
  })

  it('증감률을 계산하지 않았으면 다시 계산하지 않고 사유를 적는다', () => {
    const row = factsView([fact({ previousAmount: 0, changeAmount: 3_450_000_000, changeRate: null, calcStatus: 'PREVIOUS_ZERO' })])?.rows[0]

    expect(row?.change).toBe('▲ 3,450')
    expect(row?.rate).toBe('계산 불가 · 이전 값 0')
  })

  it('한쪽 값이 없으면 0이 아니라 미기재로 적는다', () => {
    const row = factsView([fact({ previousAmount: null, changeAmount: null, changeRate: null, calcStatus: 'PREVIOUS_MISSING' })])?.rows[0]

    expect(row?.previous).toBe('미기재')
    expect(row?.change).toBe('계산 불가 · 이전 값 미기재')
  })

  it('원화가 아니면 단위에 통화를 붙인다', () => {
    expect(factsView([fact({ currency: 'USD' })])?.unit).toBe('백만 USD')
  })

  it('통화가 없으면 원화 단위로 적는다', () => {
    expect(factsView([fact({ currency: null })])?.unit).toBe('백만원')
  })

  it('계정이 없거나 두 값이 모두 없으면 칸이 없다', () => {
    expect(factsView([])).toBeNull()
    expect(factsView([fact({ previousAmount: null, currentAmount: null, changeAmount: null, changeRate: null, calcStatus: 'PREVIOUS_MISSING' })])).toBeNull()
  })
})
