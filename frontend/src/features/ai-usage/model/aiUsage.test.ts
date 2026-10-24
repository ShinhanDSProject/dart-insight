import { describe, expect, it } from 'vitest'
import type { AiUsage } from '@/shared/api/system'
import {
  explanationSegments,
  formatRate,
  formatTokens,
  otherOutcomes,
  outcomeSegments,
  parseDays,
  periodText,
  questionSegments,
  reasonRows,
  taskLabel,
  usageView,
} from './aiUsage'

function usage(overrides: Partial<AiUsage> = {}): AiUsage {
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
    llmCalls: { total: 0, byOutcome: { OK: 0, INVALID_OUTPUT: 0, TRANSIENT_ERROR: 0, ERROR: 0 }, byTask: [] },
    ...overrides,
  }
}

describe('parseDays', () => {
  it('7이면 7일, 그 밖의 값이나 값이 없으면 30일', () => {
    expect(parseDays('7')).toBe(7)
    expect(parseDays('30')).toBe(30)
    expect(parseDays(null)).toBe(30)
    expect(parseDays('14')).toBe(30)
  })
})

describe('usageView', () => {
  it('질문·풀이·호출이 모두 0이면 빈 상태', () => {
    expect(usageView(usage())).toEqual({ kind: 'empty' })
  })

  it('하나라도 있으면 집계를 보인다', () => {
    const withCalls = usage({ llmCalls: { ...usage().llmCalls, total: 1 } })
    expect(usageView(withCalls)).toEqual({ kind: 'data', usage: withCalls })
  })
})

describe('formatRate', () => {
  it('비율을 퍼센트로, 평가가 없으면(null) 0%가 아니라 평가 없음으로 보인다', () => {
    expect(formatRate(0.75)).toBe('75%')
    expect(formatRate(0.6667)).toBe('66.7%')
    expect(formatRate(0)).toBe('0%')
    expect(formatRate(null)).toBe('평가 없음')
  })
})

describe('formatTokens', () => {
  it('토큰을 모르면(null) 0이 아니라 알 수 없음', () => {
    expect(formatTokens(12345)).toBe('12,345')
    expect(formatTokens(0)).toBe('0')
    expect(formatTokens(null)).toBe('알 수 없음')
  })
})

describe('periodText', () => {
  it('기간을 점으로 이은 날짜로 보인다', () => {
    expect(periodText('2026-09-26', '2026-10-25')).toBe('2026.09.26 ~ 2026.10.25')
  })
})

describe('상태 막대 조각', () => {
  it('질문 상태를 정해 둔 순서·이름·색으로 만든다', () => {
    const u = usage({
      questions: { total: 6, byStatus: { ANSWERED: 3, NOT_FOUND: 1, OUT_OF_SCOPE: 0, REVIEW_NEEDED: 2 } },
    })
    expect(questionSegments(u)).toEqual([
      { label: '답함', value: 3, text: '3', tone: 'series-1' },
      { label: '근거 못 찾음', value: 1, text: '1', tone: 'series-2' },
      { label: '답하지 않는 질문', value: 0, text: '0', tone: 'series-3' },
      { label: '검토 필요', value: 2, text: '2', tone: 'series-4' },
    ])
  })

  it('검토 필요는 질문·풀이·호출 막대에서 같은 색을 쓴다', () => {
    const u = usage()
    const reviewTone = (segs: { label: string; tone: string }[], label: string) =>
      segs.find((s) => s.label === label)?.tone
    expect(reviewTone(questionSegments(u), '검토 필요')).toBe('series-4')
    expect(reviewTone(explanationSegments(u), '검토 필요')).toBe('series-4')
    expect(reviewTone(outcomeSegments(u), '검증 실패로 다시 만듦')).toBe('series-4')
  })

  it('빠진 키는 0으로 센다', () => {
    const u = usage({
      llmCalls: { total: 2, byOutcome: { OK: 2 } as AiUsage['llmCalls']['byOutcome'], byTask: [] },
    })
    expect(outcomeSegments(u).map((s) => s.value)).toEqual([2, 0, 0, 0])
  })
})

describe('otherOutcomes', () => {
  it('정해 둔 네 값 밖의 결과만 0보다 클 때 돌려준다', () => {
    const u = usage({
      llmCalls: {
        total: 3,
        byOutcome: { OK: 1, INVALID_OUTPUT: 0, TRANSIENT_ERROR: 0, ERROR: 0, TIMEOUT: 2, EMPTY: 0 },
        byTask: [],
      },
    })
    expect(otherOutcomes(u)).toEqual([{ outcome: 'TIMEOUT', count: 2 }])
  })
})

describe('reasonRows', () => {
  it('사유를 답 카드와 같은 순서·문구로, 수와 함께 돌려준다', () => {
    const u = usage({
      feedback: {
        ...usage().feedback,
        reasons: { WRONG_SOURCE: 2, NOT_ANSWERED: 0, HARD_TO_READ: 1, OTHER: 0 },
      },
    })
    expect(reasonRows(u)).toEqual([
      { reason: 'WRONG_SOURCE', label: '근거가 안 맞아요', count: 2 },
      { reason: 'NOT_ANSWERED', label: '질문에 답하지 않았어요', count: 0 },
      { reason: 'HARD_TO_READ', label: '이해하기 어려워요', count: 1 },
      { reason: 'OTHER', label: '기타', count: 0 },
    ])
  })
})

describe('taskLabel', () => {
  it('아는 작업은 한국어 이름, 모르는 작업은 기록된 이름 그대로', () => {
    expect(taskLabel('answer')).toBe('질문 답')
    expect(taskLabel('summary')).toBe('요약·풀이')
    expect(taskLabel('translate')).toBe('translate')
  })
})
