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
