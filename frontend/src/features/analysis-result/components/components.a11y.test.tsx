// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import { ApiError } from '@/shared/api/client'
import type { ChatMessageResponse } from '@/shared/api/agentChat'
import type { TextExplanation } from '@/shared/api/textChanges'
import type { AuthState } from '@/shared/auth/authContext'
import type { AsyncState, LoadState } from '@/shared/hooks/asyncState'
import { axeViolations } from '@/test/axe'
import type { FinancialOverview, TextOverview } from '../model/overview'
import type { HeadlineLine } from '../model/summaryHeadline'
import type { AgentChatController } from '../hooks/useAgentChat'
import { initialChatState, type ChatState } from '../model/chatState'
import { ChangeOverview } from './ChangeOverview'
import { ChatPanel } from './ChatPanel'
import { NumberChangesLine } from './NumberChangesLine'
import { SummaryHeadline } from './SummaryHeadline'
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

// 채팅의 쓰기 확인 버튼은 로그인 상태를 본다. 답 평가는 저장 호출만 바꿔 끼운다
const auth = vi.hoisted(() => ({ state: { status: 'authenticated', userId: 1 } as AuthState }))
vi.mock('@/shared/auth/authContext', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/auth/authContext')>()),
  useAuth: () => ({ state: auth.state, login: vi.fn(), logout: vi.fn() }),
}))
const feedbackApi = vi.hoisted(() => ({ sendAnswerFeedback: vi.fn() }))
vi.mock('@/shared/api/questions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/questions')>()),
  sendAnswerFeedback: feedbackApi.sendAnswerFeedback,
}))

const noop = () => {}
const ai = { model: 'test-model', promptVersion: 'ask-v1', generatedAt: '2025-10-20T10:00:00+09:00' }
const apiError = new ApiError(503, { code: 'AI_SERVER_UNAVAILABLE', message: 'AI 서버를 쓸 수 없어요.', traceId: 'trace-1', errors: [] })

const chatAnswer: ChatMessageResponse = {
  status: 'ANSWERED',
  answer: '소송 관련 변경은 1건이에요[1]. 영업이익은 줄었어요[2].',
  message: null,
  citations: [
    {
      no: 1,
      kind: 'TEXT_CHANGE',
      evidenceId: 'T5012',
      changeId: 5012,
      changeType: 'ADDED',
      rceptNo: '20250814000123',
      reportName: '반기보고서 (2025.06)',
      sectionPath: 'XI. 그 밖에 투자자 보호를 위하여 필요한 사항 > 2. 우발부채 등에 관한 사항',
      quote: '당사는 특허 침해 소송을 제기받았습니다.',
    },
    { no: 2, kind: 'FINANCIAL_CHANGE', evidenceId: 'F31', changeId: 31, sjDiv: 'IS', accountName: '영업이익', sentence: '영업이익이 줄었어요.' },
  ],
  actions: [
    { type: 'OPEN_TAB', label: '문장 변화에서 보기', tab: 'text', filters: { q: '소송' } },
    { type: 'OPEN_GLOSSARY', label: '용어 사전 열기', term: '정정공시' },
    { type: 'DOWNLOAD_BRIEF', label: '비교 브리프 내려받기' },
  ],
  format: 'CHAT',
  crossCheck: null,
  questionId: null,
  aiGenerated: true,
  ai,
}

function chatController(state: ChatState): AgentChatController {
  return { state, send: noop, retry: noop, setDraft: noop, markConfirmed: noop }
}

function chatPanel(state: ChatState, briefState: AsyncState<void> = { status: 'idle' }) {
  return (
    <MemoryRouter>
      <ChatPanel
        analysisId={42}
        briefState={briefState}
        chat={chatController(state)}
        context={{ tab: 'text' }}
        suggestions={['매출 변화의 이유는 무엇인가요?']}
        onNavigate={noop}
        onDownloadBrief={noop}
        onPostDraft={noop}
        onClose={noop}
      />
    </MemoryRouter>
  )
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
  aiGenerated: true,
  ai,
  cached: false,
}

afterEach(cleanup)

async function expectNoViolations(ui: ReactNode) {
  const { container } = render(<main>{ui}</main>)
  expect(await axeViolations(container)).toBe('')
  return container
}

describe('AI 에이전트 채팅 패널 접근성(axe)', () => {
  it('예시 요청만 있는 빈 패널에 위반이 없다', async () => {
    await expectNoViolations(chatPanel(initialChatState))
  })

  it('근거 칩·액션이 있는 답과 답이 없는 상태들이 쌓여도 위반이 없다', async () => {
    const empty = { ...chatAnswer, answer: null, citations: [], actions: [], aiGenerated: false, ai: null }
    const exchanges = [
      { id: 1, message: '소송 관련 변경 보여줘', response: chatAnswer },
      { id: 2, message: '합병 관련 변경', response: { ...empty, status: 'NOT_FOUND' as const, message: '확인된 설명 없음' } },
      { id: 3, message: '지금 사도 돼?', response: { ...empty, status: 'OUT_OF_SCOPE' as const } },
      { id: 4, message: '전부 찾아줘', response: { ...empty, status: 'INCOMPLETE' as const } },
      { id: 5, message: '이유는?', response: { ...empty, status: 'REVIEW_NEEDED' as const } },
    ]
    const container = await expectNoViolations(chatPanel({ ...initialChatState, exchanges }))
    fireEvent.click(screen.getByRole('button', { name: '용어 사전 열기: 정정공시' }))
    expect(screen.getByText(/이미 낸 보고서를 고쳐 다시 낸 것이에요/)).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('근거 질문으로 저장된 답에만 평가 버튼이 붙고, 누르면 그 질문에 평가를 저장한다(AC21)', async () => {
    feedbackApi.sendAnswerFeedback.mockResolvedValue({ questionId: 7, helpful: true, reason: null, updatedAt: '2026-11-04T10:00:00' })
    const asked = { ...chatAnswer, questionId: 7 }
    const exchanges = [
      { id: 1, message: '소송 관련 변경 보여줘', response: chatAnswer },
      { id: 2, message: '소송 이유는?', response: asked },
    ]
    await expectNoViolations(chatPanel({ ...initialChatState, exchanges }))
    const groups = screen.getAllByRole('group', { name: '도움이 됐나요?' })
    expect(groups).toHaveLength(1)
    fireEvent.click(screen.getByRole('button', { name: '도움이 됐어요' }))
    expect(await screen.findByText('의견 고마워요')).toBeTruthy()
    expect(feedbackApi.sendAnswerFeedback).toHaveBeenCalledWith(42, 7, { helpful: true, reason: null })
  })

  it('쓰기 확인 버튼은 로그인했으면 버튼으로, 아니면 로그인 안내로 보인다(AC9·AC10)', async () => {
    const confirm = {
      ...chatAnswer,
      actions: [
        { type: 'CONFIRM_SAVE_NOTE', label: '노트에 담기', note: { kind: 'TEXT_CHANGE', analysisId: 42, changeId: 5012, memo: null } },
        { type: 'CONFIRM_FAVORITE', label: '관심 기업에 추가', corpCode: '00126380' },
      ],
    }
    const exchanges = [{ id: 1, message: '이거 노트에 담아줘', response: confirm }]
    await expectNoViolations(chatPanel({ ...initialChatState, exchanges }))
    expect(screen.getByRole('button', { name: '노트에 담기' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '관심 기업에 추가' })).toBeTruthy()
    cleanup()

    auth.state = { status: 'anonymous' }
    await expectNoViolations(chatPanel({ ...initialChatState, exchanges }))
    expect(screen.queryByRole('button', { name: '노트에 담기' })).toBeNull()
    expect(screen.getAllByRole('link', { name: '로그인하기' })).toHaveLength(2)
    auth.state = { status: 'authenticated', userId: 1 }
  })

  it('브리프를 받는 중이면 버튼을 끄고, 실패하면 다시 시도하라고 알린다', async () => {
    const exchanges = [{ id: 1, message: '브리프 줘', response: chatAnswer }]
    await expectNoViolations(chatPanel({ ...initialChatState, exchanges }, { status: 'loading' }))
    expect((screen.getByRole('button', { name: /내보내는 중/ }) as HTMLButtonElement).disabled).toBe(true)
    cleanup()
    await expectNoViolations(chatPanel({ ...initialChatState, exchanges }, { status: 'error', error: apiError }))
    expect(screen.getByRole('alert').textContent).toContain('브리프를 내려받지 못했어요')
    expect((screen.getByRole('button', { name: /비교 브리프 내려받기/ }) as HTMLButtonElement).disabled).toBe(false)
  })

  it('보내는 중·보내지 못한 상태에 위반이 없다', async () => {
    await expectNoViolations(chatPanel({ ...initialChatState, request: { status: 'sending', message: '영업이익 어디 있어?' } }))
    cleanup()
    await expectNoViolations(
      chatPanel({ ...initialChatState, request: { status: 'error', message: '영업이익은요?', error: apiError } }),
    )
  })
})

/** 요약 탭이 넘기는 것처럼 모킹한 개요 응답을 그대로 넘긴다 */
function Overview() {
  return (
    <ChangeOverview
      financial={{ state: overview.financial, reload: noop }}
      text={{ state: overview.text, reload: noop }}
      onOpenChangedAccounts={noop}
      onOpenTextList={noop}
      onOpenPriorityList={noop}
    />
  )
}

describe('변화 개요 접근성(axe)', () => {
  beforeEach(() => {
    overview.financial = { status: 'loading' }
    overview.text = { status: 'loading' }
  })

  it('숫자를 불러온 개요에 위반이 없다', async () => {
    overview.financial = { status: 'success', data: { changed: 12, firstChangedSjDiv: 'BS' } }
    overview.text = {
      status: 'success',
      data: {
        status: 'available',
        all: 20,
        added: 5,
        deleted: 3,
        modified: 10,
        numericUpdate: 1,
        moved: 1,
        reviewNeeded: 2,
        partial: true,
        high: 4,
        sections: [
          { title: '(목차 밖 본문)', count: 2 },
          { title: 'II. 사업의 내용', count: 18 },
        ],
      },
    }
    const container = await expectNoViolations(<Overview />)
    expect(container.querySelectorAll('.overview-stat')).toHaveLength(4)
    expect(container.textContent).toContain('바뀐 문장20(일부 섹션만 비교했어요)')
    expect(container.textContent).toContain('먼저 볼 것4, 우선순위 높음')
  })

  it('불러오는 중·실패·확인 안 됨 개요에 위반이 없다', async () => {
    overview.financial = { status: 'error', error: apiError }
    await expectNoViolations(<Overview />)
    cleanup()
    overview.financial = { status: 'success', data: { changed: null, firstChangedSjDiv: null } }
    overview.text = { status: 'success', data: { status: 'unavailable' } }
    await expectNoViolations(<Overview />)
  })
})

describe('핵심 3줄 접근성(axe)', () => {
  const lines: HeadlineLine[] = [
    { itemNo: 1, kind: 'FINANCIAL', text: '매출액이 1,000억원에서 1,100억원으로 10.0% 늘었어요.', aiGenerated: false, target: { type: 'FINANCIAL', changeId: 31, sjDiv: 'IS', changeType: null } },
    { itemNo: 2, kind: 'FINANCIAL', text: '부채총계가 800억원에서 600억원으로 25.0% 줄었어요.', aiGenerated: false, target: { type: 'FINANCIAL', changeId: null, sjDiv: 'BS', changeType: null } },
    { itemNo: 3, kind: 'TEXT', text: '새 공장 투자 계획이 추가됐어요.', aiGenerated: true, target: { type: 'TEXT', changeId: 5, sjDiv: null, changeType: null } },
  ]
  const opener = (target: HeadlineLine['target']) => (target.changeId === null ? null : noop)

  it('누를 수 있는 줄과 열 수 없는 줄이 섞여도 위반이 없다', async () => {
    const container = await expectNoViolations(<SummaryHeadline lines={lines} opener={opener} />)
    expect(screen.getByRole('heading', { name: '이번 비교의 핵심' })).toBeTruthy()
    expect(container.querySelectorAll('.headline__line')).toHaveLength(3)
    expect(screen.getAllByRole('button')).toHaveLength(2)
    expect(screen.getAllByText('AI 생성')).toHaveLength(1)
  })

  it('줄을 누르면 그 항목의 근거를 연다', () => {
    const open = vi.fn()
    render(<SummaryHeadline lines={lines.slice(2)} opener={() => open} />)
    fireEvent.click(screen.getByRole('button', { name: /새 공장 투자 계획/ }))
    expect(open).toHaveBeenCalledTimes(1)
  })

  it('고를 줄이 없으면 그리지 않는다', () => {
    const { container } = render(<SummaryHeadline lines={[]} opener={opener} />)
    expect(container.innerHTML).toBe('')
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
        {box({ status: 'success', data: { ...explanation, changeId: 6, status: 'REVIEW_NEEDED', sentence: null, aiGenerated: false } }, 'e3')}
        {box({ status: 'success', data: { ...explanation, changeId: 7, status: 'NO_SOURCE', sentence: null, evidence: [], aiGenerated: false, ai: null } }, 'e4')}
        {box({ status: 'error', error: apiError }, 'e5')}
      </>,
    )
  })
})

describe('바뀐 숫자 줄 접근성(axe)', () => {
  const changes = {
    pairs: [
      { before: '230개', after: '309개' },
      { before: '33개', after: '36개' },
    ],
    rest: 3,
  }

  it('바뀐 숫자 쌍과 나머지 수가 있어도 위반이 없다', async () => {
    await expectNoViolations(<NumberChangesLine changes={changes} />)
  })

  it('목록 이름은 바뀐 숫자이고 쌍마다 이전·현재로 읽힌다', () => {
    render(<NumberChangesLine changes={changes} />)
    const list = screen.getByRole('list', { name: '바뀐 숫자' })
    expect(list.textContent).toContain('이전 230개→, 현재 309개')
    expect(list.textContent).toContain('외 3개')
  })
})
