// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import { ApiError } from '@/shared/api/client'
import type { QuestionAnswer } from '@/shared/api/questions'
import type { FinancialChangeItem } from '@/shared/api/results'
import type { TextExplanation } from '@/shared/api/textChanges'
import type { LoadState } from '@/shared/hooks/asyncState'
import { axeViolations } from '@/test/axe'
import type { FinancialOverview, TextOverview } from '../model/overview'
import { AnswerCard, FailedAnswerCard, PendingAnswerCard, type FollowUp } from './AnswerCard'
import { ChangeOverview } from './ChangeOverview'
import { FinancialChart } from './FinancialChart'
import { TextExplanationBox } from './TextExplanationBox'

// 변화 개요는 숫자를 불러오는 훅만 바꿔 끼워 상태마다 고정된 화면을 그린다
const overview = vi.hoisted(() => ({
  financial: { status: 'loading' } as LoadState<FinancialOverview>,
  text: { status: 'loading' } as LoadState<TextOverview>,
}))
vi.mock('../hooks/useChangeOverview', () => ({
  useChangeOverview: () => ({
    financial: { state: overview.financial, reload: () => {} },
    text: { state: overview.text, reload: () => {} },
  }),
}))

const noop = () => {}
const links = { onOpenSource: noop, onOpenFinancial: noop, onSearchText: noop }
const onFeedback = () => Promise.resolve()
const followUp: FollowUp = { questions: ['매출 변화의 이유는 무엇인가요?', '새로 생긴 위험 요인이 있나요?'], onAsk: noop, disabled: false }
const ai = { model: 'test-model', promptVersion: 'ask-v1', generatedAt: '2025-10-20T10:00:00+09:00' }
const apiError = new ApiError(503, { code: 'AI_SERVER_UNAVAILABLE', message: 'AI 서버를 쓸 수 없어요.', traceId: 'trace-1', errors: [] })

const answered: QuestionAnswer = {
  questionId: 7,
  question: '매출이 왜 늘었나요?',
  status: 'ANSWERED',
  answer: '반도체 판매가 늘었어요[1]. 매출액은 10.0% 늘었어요[F1].',
  message: null,
  citations: [
    {
      no: 1,
      evidenceId: '20250814000123#B12',
      side: 'current',
      rceptNo: '20250814000123',
      reportName: '반기보고서 (2025.06)',
      sectionNo: 3,
      blockNo: 12,
      sectionPath: 'II. 사업의 내용 > 1. 사업의 개요',
      quote: '반도체 부문의 판매가 늘었습니다.',
    },
  ],
  facts: [{ ref: 'F1', changeId: 31, sjDiv: 'IS', accountName: '매출액', sentence: '매출액이 1,000억원에서 1,100억원으로 10.0% 늘었어요.' }],
  ai,
  feedback: { helpful: false, reason: 'WRONG_SOURCE' },
  createdAt: '2025-10-20T10:00:00+09:00',
}

const analysis = {
  previous: { reportName: '반기보고서 (2024.06)' },
  current: { reportName: '반기보고서 (2025.06)' },
} as Analysis

const explanation: TextExplanation = {
  changeId: 5,
  status: 'OK',
  sentence: '새 공장 투자 계획이 추가됐어요.',
  message: null,
  evidence: [
    { side: 'previous', rceptNo: '20240814000001', sectionNo: 4, blockNo: 2, sectionPath: 'II. 사업의 내용', evidenceId: '20240814000001#B2' },
    { side: 'current', rceptNo: '20250814000123', sectionNo: null, blockNo: 9, sectionPath: null, evidenceId: '20250814000123#B9' },
  ],
  ai,
  cached: false,
}

function chartItem(changeId: number, accountName: string, previousAmount: number, currentAmount: number): FinancialChangeItem {
  const changeAmount = currentAmount - previousAmount
  return {
    changeId,
    sjDiv: 'BS',
    accountName,
    amountBasis: null,
    previousAmount,
    currentAmount,
    changeAmount,
    changeRate: previousAmount > 0 ? changeAmount / previousAmount : null,
    direction: changeAmount > 0 ? 'UP' : changeAmount < 0 ? 'DOWN' : 'SAME',
    calcStatus: previousAmount > 0 ? 'OK' : 'PREVIOUS_ZERO',
    calcMessage: null,
    currency: 'KRW',
  }
}

afterEach(cleanup)

async function expectNoViolations(ui: ReactNode) {
  const { container } = render(<main>{ui}</main>)
  expect(await axeViolations(container)).toBe('')
  return container
}

describe('질문 답 카드 접근성(axe)', () => {
  it('인용·수치·평가 사유·이어서 물어보기가 있는 답이 여러 개 쌓여도 위반이 없다', async () => {
    await expectNoViolations(
      <>
        <AnswerCard item={answered} links={links} onFeedback={onFeedback} followUp={followUp} />
        <AnswerCard item={{ ...answered, questionId: 8, feedback: null }} links={links} onFeedback={onFeedback} followUp={followUp} />
      </>,
    )
  })

  it('찾지 못함·답하지 않음·검토 필요 답에 위반이 없다', async () => {
    const base = { ...answered, answer: null, citations: [], facts: [], feedback: null }
    await expectNoViolations(
      <>
        <AnswerCard item={{ ...base, questionId: 1, status: 'NOT_FOUND', ai: null }} links={links} onFeedback={onFeedback} followUp={followUp} />
        <AnswerCard
          item={{ ...base, questionId: 2, status: 'OUT_OF_SCOPE', ai: null }}
          links={links}
          onFeedback={onFeedback}
          followUp={{ ...followUp, questions: [] }}
        />
        <AnswerCard item={{ ...base, questionId: 3, status: 'REVIEW_NEEDED' }} links={links} onFeedback={onFeedback} followUp={{ ...followUp, disabled: true }} />
      </>,
    )
  })

  it('답을 기다리는 카드와 보내지 못한 카드에 위반이 없다', async () => {
    await expectNoViolations(
      <>
        <PendingAnswerCard question="매출이 왜 늘었나요?" />
        <FailedAnswerCard question="영업이익은요?" error={apiError} onRetry={noop} />
      </>,
    )
  })
})

describe('변화 개요 접근성(axe)', () => {
  beforeEach(() => {
    overview.financial = { status: 'loading' }
    overview.text = { status: 'loading' }
  })

  it('숫자를 불러온 개요에 위반이 없다', async () => {
    overview.financial = { status: 'success', data: { changed: 12, firstChangedSjDiv: 'BS' } }
    overview.text = {
      status: 'success',
      data: { status: 'available', all: 20, added: 5, deleted: 3, modified: 12, reviewNeeded: 2, partial: true },
    }
    await expectNoViolations(<ChangeOverview analysisId={1} onOpenChangedAccounts={noop} onOpenTextList={noop} />)
  })

  it('불러오는 중·실패·확인 안 됨 개요에 위반이 없다', async () => {
    overview.financial = { status: 'error', error: apiError }
    await expectNoViolations(<ChangeOverview analysisId={1} onOpenChangedAccounts={noop} onOpenTextList={noop} />)
    cleanup()
    overview.financial = { status: 'success', data: { changed: null, firstChangedSjDiv: null } }
    overview.text = { status: 'success', data: { status: 'unavailable' } }
    await expectNoViolations(<ChangeOverview analysisId={1} onOpenChangedAccounts={noop} onOpenTextList={noop} />)
  })
})

describe('재무 수치 차트 접근성(axe)', () => {
  const items = [
    chartItem(1, '자산총계', 1_000_000_000, 1_200_000_000),
    chartItem(2, '부채총계', 800_000_000, 600_000_000),
    chartItem(3, '이익잉여금', 0, 50_000_000),
  ]
  const props = {
    items,
    statementLabel: '재무상태표',
    unit: 'MILLION' as const,
    currency: 'KRW',
    previousPeriod: '2024.06.30',
    currentPeriod: '2025.06.30',
    selectedChangeId: 1,
    onSelect: noop,
  }

  it('증감률 보기와 금액 보기에 위반이 없다', async () => {
    const container = await expectNoViolations(<FinancialChart {...props} />)
    fireEvent.click(screen.getByRole('button', { name: '금액' }))
    expect(await axeViolations(container)).toBe('')
  })
})

describe('AI 한 줄 풀이 접근성(axe)', () => {
  const box = (entry: Parameters<typeof TextExplanationBox>[0]['entry'], id: string) => (
    <TextExplanationBox id={id} entry={entry} analysis={analysis} onRetry={noop} onOpenSource={noop} />
  )

  it('기다림·풀이·검토 필요·원문 없음·오류 상태에 위반이 없다', async () => {
    await expectNoViolations(
      <>
        {box({ status: 'loading' }, 'e1')}
        {box({ status: 'success', data: explanation }, 'e2')}
        {box({ status: 'success', data: { ...explanation, changeId: 6, status: 'REVIEW_NEEDED', sentence: null } }, 'e3')}
        {box({ status: 'success', data: { ...explanation, changeId: 7, status: 'NO_SOURCE', sentence: null, evidence: [], ai: null } }, 'e4')}
        {box({ status: 'error', error: apiError }, 'e5')}
      </>,
    )
  })
})
