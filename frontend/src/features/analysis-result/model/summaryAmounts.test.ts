import { describe, expect, it } from 'vitest'
import type { FinancialChangeItem } from '@/shared/api/results'
import type { SummaryItem } from '@/shared/api/summary'
import { amountsById, summarySjDivs } from './summaryAmounts'

function summary(kind: 'FINANCIAL' | 'TEXT', sjDiv: 'IS' | 'BS' | null, changeId: number): SummaryItem {
  return {
    itemNo: changeId,
    kind,
    target: { type: kind, changeId, sjDiv },
    factSentence: null,
    aiText: null,
    aiGenerated: false,
    explanationStatus: null,
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
