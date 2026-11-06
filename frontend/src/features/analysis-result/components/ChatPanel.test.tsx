// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import type { ChatMessageResponse } from '@/shared/api/agentChat'
import type { AgentChatController } from '../hooks/useAgentChat'
import { initialChatState } from '../model/chatState'
import { ChatPanel } from './ChatPanel'

const noop = () => {}

const answered: ChatMessageResponse = {
  status: 'ANSWERED',
  answer: '매출액이 늘었어요[1].',
  message: null,
  citations: [],
  actions: [],
  format: 'CHAT',
  crossCheck: null,
  questionId: null,
  aiGenerated: false,
  ai: null,
}

function renderWith(response: ChatMessageResponse) {
  const chat = {
    state: { ...initialChatState, exchanges: [{ id: 1, message: '매출액은?', response }] },
    send: noop,
    retry: noop,
    setDraft: noop,
    markConfirmed: noop,
  } as unknown as AgentChatController
  return render(
    <MemoryRouter>
      <ChatPanel
        analysisId={16}
        chat={chat}
        context={{} as never}
        suggestions={[]}
        onNavigate={noop}
        onDownloadBrief={noop}
        briefState={{ status: 'idle' }}
        onPostDraft={noop}
        onClose={noop}
      />
    </MemoryRouter>,
  )
}

afterEach(cleanup)

describe('채팅 답의 상태 안내 캐릭터(#706)', () => {
  it('근거 인용이 없는 답에는 근거를 찾았다는 줄을 붙이지 않는다', () => {
    const { container } = renderWith(answered)
    expect(screen.queryByText('원문에서 근거를 찾았어요')).toBeNull()
    expect(container.querySelector('.mascot--joy')).toBeNull()
  })

  it('근거 인용이 있는 답에만 근거를 찾았다는 줄과 캐릭터를 붙인다', () => {
    const citation: ChatMessageResponse['citations'][number] = {
      no: 1,
      kind: 'BLOCK',
      evidenceId: '20260814003699#B140',
      side: 'current',
      rceptNo: '20260814003699',
      blockNo: 140,
    }
    const { container } = renderWith({ ...answered, citations: [citation] })
    expect(screen.getByText('원문에서 근거를 찾았어요')).toBeTruthy()
    expect(container.querySelector('.mascot--joy')).not.toBeNull()
  })
})

describe('채팅 추가 표시(#584)', () => {
  const value: ChatMessageResponse['citations'][number] = {
    no: 1,
    kind: 'FINANCIAL_CHANGE',
    evidenceId: 'F31',
    changeId: 31,
    sjDiv: 'IS',
    accountName: '영업이익',
  }

  it('정리 형식 답은 줄마다 목록 한 칸이고 줄 끝에 근거 칩이 붙는다(AC24)', () => {
    const { container } = renderWith({
      ...answered,
      format: 'BRIEF',
      answer: '- 영업이익이 줄었어요[1]\n- 영업이익 계정이 바뀌었어요[1]',
      citations: [value],
    })
    const items = container.querySelectorAll('.chat-panel__brief-list li')
    expect(items).toHaveLength(2)
    items.forEach((item) => expect(item.querySelector('.chat-panel__citation')?.textContent).toContain('[1] 영업이익'))
  })

  it('교차 검증 어긋남은 검토해 볼 신호로 보이고 답이 검토 필요여도 결과를 보인다(AC19)', () => {
    renderWith({
      ...answered,
      status: 'REVIEW_NEEDED',
      answer: null,
      message: '검토가 필요해요.',
      crossCheck: { result: 'POTENTIAL_MISMATCH', reason: '대조한 계정 1개 중 1개의 회사 설명 방향이 수치 방향과 반대예요.' },
    })
    expect(screen.getByText('교차 검증: 검토해 볼 신호')).toBeTruthy()
    expect(screen.getByText(/수치 방향과 반대예요/)).toBeTruthy()
    expect(screen.queryByText(/허위|오류/)).toBeNull()
  })

  it('다른 분석·기업 나란히 보기 액션은 그 화면으로 가는 링크다(AC27)', () => {
    renderWith({
      ...answered,
      actions: [
        { type: 'OPEN_ANALYSIS', label: '분석 결과 열기', analysisId: 21 },
        { type: 'OPEN_COMPANY_COMPARE', label: '기업 나란히 보기', corpCodes: ['00126380', '00164779'] },
      ],
    })
    expect(screen.getByRole('link', { name: '분석 결과 열기' }).getAttribute('href')).toBe('/analyses/21')
    expect(screen.getByRole('link', { name: '기업 나란히 보기' }).getAttribute('href')).toBe(
      '/compare/companies?corps=00126380,00164779',
    )
  })
})
