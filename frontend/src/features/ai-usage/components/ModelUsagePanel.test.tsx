// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AiUsage } from '@/shared/api/system'
import { axeViolations } from '@/test/axe'
import { ModelUsagePanel } from './ModelUsagePanel'

const usage: AiUsage = {
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
    total: 3,
    byOutcome: { OK: 3, INVALID_OUTPUT: 0, TRANSIENT_ERROR: 0, ERROR: 0 },
    byTask: [],
    byModel: [
      { provider: 'fake', model: 'fake-model', calls: 1, inputTokens: 100, outputTokens: 10, estimatedCostUsd: null, byTask: [] },
      {
        provider: 'openai',
        model: 'gpt-6.1-sol',
        calls: 2,
        inputTokens: 10000,
        outputTokens: 1200,
        estimatedCostUsd: 0.032,
        byTask: [],
      },
    ],
    perUnit: {
      analysis: { count: 2, avgInputTokens: 30000, avgOutputTokens: 2001, avgCostUsd: 0.08 },
      briefing: { count: 1, avgInputTokens: 1000, avgOutputTokens: 100, avgCostUsd: null },
    },
  },
}

afterEach(cleanup)

describe('ModelUsagePanel', () => {
  it('모델별 표와 1건당 평균을 보이고, 가격이 없으면 가격 설정 없음으로 보인다', async () => {
    const { container } = render(<ModelUsagePanel usage={usage} realOnly={false} onRealOnlyChange={() => {}} />)
    expect(screen.getByRole('rowheader', { name: 'fake-model' })).toBeTruthy()
    expect(screen.getByRole('rowheader', { name: 'gpt-6.1-sol' })).toBeTruthy()
    expect(screen.getByText('$0.032')).toBeTruthy()
    expect(screen.getAllByText('가격 설정 없음')).toHaveLength(2)
    expect(screen.getByText('분석 1건당 평균')).toBeTruthy()
    expect(screen.getByText('$0.08')).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('실제 제공자만 보기면 가짜 제공자 행을 숨기고, 체크하면 바뀐 값을 알린다', async () => {
    const onChange = vi.fn()
    const { container } = render(<ModelUsagePanel usage={usage} realOnly onRealOnlyChange={onChange} />)
    expect(screen.queryByRole('rowheader', { name: 'fake-model' })).toBeNull()
    expect(screen.getByRole('rowheader', { name: 'gpt-6.1-sol' })).toBeTruthy()
    const toggle = screen.getByRole('checkbox', { name: '실제 제공자만 보기' })
    fireEvent.click(toggle)
    expect(onChange).toHaveBeenCalledWith(false)
    expect(await axeViolations(container)).toBe('')
  })
})
