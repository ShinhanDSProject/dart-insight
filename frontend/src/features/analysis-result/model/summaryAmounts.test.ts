import { describe, expect, it } from 'vitest'
import type { FinancialChangeItem } from '@/shared/api/results'
import type { SummaryItem } from '@/shared/api/summary'
import { amountBars, amountsById, summarySjDivs } from './summaryAmounts'

function summary(kind: 'FINANCIAL' | 'TEXT', sjDiv: 'IS' | 'BS' | null, changeId: number): SummaryItem {
  return {
    itemNo: changeId,
    kind,
    target: { type: kind, changeId, sjDiv, changeType: null },
    lens: 'OTHER',
    lensLabel: '기타',
    factSentence: null,
    aiText: null,
    aiGenerated: false,
    explanationStatus: null,
    explanationGrade: null,
    quote: null,
    quoteEvidence: null,
    gradeReason: null,
    evidence: [],
    ai: null,
  }
}

describe('summaryAmounts', () => {
  it('재무 항목의 재무제표만 겹치지 않게 고른다', () => {
    expect(summarySjDivs([summary('FINANCIAL', 'IS', 1), summary('FINANCIAL', 'BS', 2), summary('FINANCIAL', 'IS', 3), summary('TEXT', null, 4)])).toEqual(['BS', 'IS'])
  })

  it('changeId로 계정 값을 찾는다', () => {
    const item = { changeId: 7, previousAmount: 1, currentAmount: 2 } as FinancialChangeItem
    expect(amountsById([item]).get(7)).toBe(item)
    expect(amountsById([item]).get(8)).toBeUndefined()
  })
})

describe('핵심 카드 막대', () => {
  const amount = (previousAmount: number | null, currentAmount: number | null, changeRate: number | null, direction: FinancialChangeItem['direction']) =>
    ({ changeId: 1, previousAmount, currentAmount, changeRate, direction, currency: 'KRW' }) as FinancialChangeItem

  it('큰 쪽을 꽉 찬 막대로 보고 작은 쪽은 비율로, 증감률에는 ▲▼를 붙인다', () => {
    const bars = amountBars(amount(190_600_000_000, 342_700_000_000, 0.798, 'UP'))
    expect(bars.current.ratio).toBe(1)
    expect(bars.previous.ratio).toBeCloseTo(0.556, 3)
    expect(bars.rate).toBe('▲ +79.8%')
    expect(amountBars(amount(200, 50, -0.75, 'DOWN')).rate).toBe('▼ −75.0%')
  })

  it('음수는 절댓값으로 길이를 정하고, 값이 없으면 막대 0과 없음, 증감률이 없으면 null', () => {
    expect(amountBars(amount(-100, 50, null, null)).previous.ratio).toBe(1)
    const missing = amountBars(amount(null, 30, null, null))
    expect(missing.previous).toEqual({ label: '없음', ratio: 0 })
    expect(missing.rate).toBeNull()
    expect(amountBars(amount(0, 0, null, 'SAME')).current.ratio).toBe(0)
  })
})
