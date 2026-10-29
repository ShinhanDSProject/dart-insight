import { describe, expect, it } from 'vitest'
import type { LensCount, SummaryItem, SummaryLens } from '@/shared/api/summary'
import {
  effectiveLens,
  filterByLens,
  groupByLens,
  LENS_NOTE,
  LENS_QUESTION_LEAD,
  LENS_QUESTIONS,
  parseSummaryLens,
  summaryLenses,
  visibleLensCounts,
} from './summaryLens'

const labels: Record<SummaryLens, string> = {
  PROFITABILITY: '수익성',
  GROWTH: '성장',
  STABILITY: '재무 안정성',
  CASH_FLOW: '현금흐름',
  SHAREHOLDER: '주주 환원',
  RISK: '위험',
  OTHER: '기타',
}

function item(itemNo: number, lens: SummaryLens, kind: 'FINANCIAL' | 'TEXT' = 'FINANCIAL'): SummaryItem {
  return {
    itemNo,
    kind,
    target: { type: kind, changeId: itemNo, sjDiv: kind === 'FINANCIAL' ? 'IS' : null },
    lens,
    lensLabel: labels[lens],
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

function counts(values: Partial<Record<SummaryLens, number>>): LensCount[] {
  return summaryLenses.map((lens) => ({ lens, lensLabel: labels[lens], count: values[lens] ?? 0 }))
}

describe('summaryLens', () => {
  it('관점 순서로 묶고 줄이 없는 관점은 빼며, 기타 말고는 흔히 묻는 질문을 붙인다', () => {
    const groups = groupByLens([item(1, 'GROWTH'), item(2, 'PROFITABILITY'), item(3, 'OTHER', 'TEXT'), item(4, 'PROFITABILITY')])
    expect(groups.map((g) => [g.lens, g.label, g.items.map((i) => i.itemNo)])).toEqual([
      ['PROFITABILITY', '수익성', [2, 4]],
      ['GROWTH', '성장', [1]],
      ['OTHER', '기타', [3]],
    ])
    expect(groups[0].question).toBe('매출이 늘 때 이익도 따라 늘었을까요?')
    expect(groups[2].question).toBeNull()
  })

  it('고른 관점의 줄만 남기고, null이면 모두 둔다', () => {
    const items = [item(1, 'RISK', 'TEXT'), item(2, 'STABILITY')]
    expect(filterByLens(items, 'RISK').map((i) => i.itemNo)).toEqual([1])
    expect(filterByLens(items, null)).toHaveLength(2)
  })

  it('0건 관점은 거르기에서 빼고, 주소에 남은 0건·모르는 관점은 전체로 본다', () => {
    const c = counts({ GROWTH: 1, CASH_FLOW: 2 })
    expect(visibleLensCounts(c).map((x) => x.lens)).toEqual(['GROWTH', 'CASH_FLOW'])
    expect(effectiveLens('CASH_FLOW', c)).toBe('CASH_FLOW')
    expect(effectiveLens('RISK', c)).toBeNull()
    expect(parseSummaryLens('SHAREHOLDER')).toBe('SHAREHOLDER')
    expect(parseSummaryLens('BUY')).toBeNull()
    expect(parseSummaryLens(null)).toBeNull()
  })

  it('질문과 안내 문구에 평가·추천·예측 표현이 없다(AC4)', () => {
    const texts = [...Object.values(LENS_QUESTIONS).filter((q) => q !== null), LENS_QUESTION_LEAD, LENS_NOTE, ...Object.values(labels)]
    for (const text of texts) {
      expect(text).not.toMatch(/우수|양호|저평가|고평가|매수|매도|추천|목표주가|전망|예상|개선|악화|좋아|나빠|좋은|나쁜|긍정|부정|위험해/)
    }
  })
})
