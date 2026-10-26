import { describe, expect, it } from 'vitest'
import type { AiUsage, AiUsageModel } from '@/shared/api/system'
import { formatUsd, modelRows, parseRealOnly, providerLabel, unitStats } from './modelUsage'

function model(provider: string, name: string, estimatedCostUsd: number | null): AiUsageModel {
  return { provider, model: name, calls: 1, inputTokens: 10, outputTokens: 1, estimatedCostUsd, byTask: [] }
}

const fake = model('fake', 'fake-model', null)
const openai = model('openai', 'gpt-6.1-sol', 0.032)

function usage(overrides: Partial<AiUsage['llmCalls']> = {}): AiUsage {
  const emptyUnit = { count: 0, avgInputTokens: null, avgOutputTokens: null, avgCostUsd: null }
  return {
    days: 30,
    from: '2026-09-26',
    to: '2026-10-25',
    questions: { total: 0, byStatus: { ANSWERED: 0, NOT_FOUND: 0, OUT_OF_SCOPE: 0, REVIEW_NEEDED: 0 } },
    feedback: {
      rated: 0,
      helpful: 0,
      notHelpful: 0,
      helpfulRate: null,
      reasons: { WRONG_SOURCE: 0, NOT_ANSWERED: 0, HARD_TO_READ: 0, OTHER: 0 },
    },
    explanations: { total: 0, byStatus: { OK: 0, REVIEW_NEEDED: 0, NO_SOURCE: 0 } },
    llmCalls: {
      total: 2,
      byOutcome: { OK: 2, INVALID_OUTPUT: 0, TRANSIENT_ERROR: 0, ERROR: 0 },
      byTask: [],
      byModel: [fake, openai],
      perUnit: { analysis: emptyUnit, briefing: emptyUnit },
      ...overrides,
    },
  }
}

describe('parseRealOnly', () => {
  it('1이면 실제 제공자만 보고, 그 밖의 값이나 값이 없으면 모두 본다', () => {
    expect(parseRealOnly('1')).toBe(true)
    expect(parseRealOnly(null)).toBe(false)
    expect(parseRealOnly('0')).toBe(false)
    expect(parseRealOnly('true')).toBe(false)
  })
})

describe('modelRows', () => {
  it('모두 보기면 가짜 제공자도 API 순서대로 보인다', () => {
    expect(modelRows(usage(), false)).toEqual([fake, openai])
  })

  it('실제 제공자만 보기면 가짜 제공자(fake)를 뺀다', () => {
    expect(modelRows(usage(), true)).toEqual([openai])
  })
})

describe('providerLabel', () => {
  it('아는 제공자는 이름을 바꾸고 모르는 제공자는 그대로 보인다', () => {
    expect(providerLabel('fake')).toBe('가짜(개발용)')
    expect(providerLabel('openai')).toBe('OpenAI')
    expect(providerLabel('anthropic')).toBe('anthropic')
  })
})

describe('formatUsd', () => {
  it('달러를 소수 둘째~넷째 자리로, 비용이 없으면(null) 0달러가 아니라 가격 설정 없음으로 보인다', () => {
    expect(formatUsd(0.032)).toBe('$0.032')
    expect(formatUsd(0.0001)).toBe('$0.0001')
    expect(formatUsd(1234.5)).toBe('$1,234.50')
    expect(formatUsd(0)).toBe('$0.00')
    expect(formatUsd(null)).toBe('가격 설정 없음')
  })
})

describe('unitStats', () => {
  it('분석·브리핑 1건당 평균 토큰과 비용을 보이고, 단위가 없으면 기록 없음', () => {
    const stats = unitStats(
      usage({
        perUnit: {
          analysis: { count: 2, avgInputTokens: 30000, avgOutputTokens: 2001, avgCostUsd: 0.08 },
          briefing: { count: 0, avgInputTokens: null, avgOutputTokens: null, avgCostUsd: null },
        },
      }),
    )
    expect(stats).toEqual([
      {
        key: 'analysis',
        label: '분석 1건당 평균',
        tokens: '입력 30,000 · 출력 2,001 토큰',
        cost: '$0.08',
        detail: '호출이 있는 분석 2건 기준',
      },
      {
        key: 'briefing',
        label: '브리핑 1건당 평균',
        tokens: '입력 알 수 없음 · 출력 알 수 없음 토큰',
        cost: '기록 없음',
        detail: '호출이 있는 브리핑 0건 기준',
      },
    ])
  })

  it('단위는 있지만 가격 설정이 없는 모델이 섞이면 가격 설정 없음', () => {
    const [analysis] = unitStats(
      usage({
        perUnit: {
          analysis: { count: 1, avgInputTokens: 100, avgOutputTokens: 10, avgCostUsd: null },
          briefing: { count: 0, avgInputTokens: null, avgOutputTokens: null, avgCostUsd: null },
        },
      }),
    )
    expect(analysis.cost).toBe('가격 설정 없음')
  })
})
