// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { useReducer } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { QuestionAnswer } from '@/shared/api/questions'
import type { AskController } from '../hooks/useAsk'
import { askReducer, initialAskState } from '../model/askState'
import { AskTab } from './AskTab'

const sections = ['(목차 밖 본문)', 'I. 회사의 개요', 'II. 사업의 내용', 'XI. 그 밖에 투자자 보호를 위하여 필요한 사항']
const INVESTOR_QUESTION = "'XI. 그 밖에 투자자 보호를 위하여 필요한 사항'에서 무엇이 바뀌었나요?"
const noop = () => {}

// 입력창 글은 실제 reducer로 두고, 보내기만 바꿔 끼워 불렸는지 본다
function Harness({ submitDraft, items = [] }: { submitDraft: () => void; items?: QuestionAnswer[] }) {
  const [state, dispatch] = useReducer(askReducer, { ...initialAskState, items })
  const ask = {
    state,
    history: { state: { status: 'success', data: { items: [] } }, reload: noop },
    setDraft: (draft: string) => dispatch({ type: 'set-draft', draft }),
    submitDraft,
    ask: noop,
    retry: noop,
    sendFeedback: () => Promise.resolve(),
  } as unknown as AskController
  return (
    <AskTab
      ask={ask}
      suggestions={{ status: 'success', data: [] }}
      sections={sections}
      onOpenSource={noop}
      onOpenFinancial={noop}
      onSearchText={noop}
    />
  )
}

function setup() {
  const submitDraft = vi.fn()
  render(<Harness submitDraft={submitDraft} />)
  const input = screen.getByRole('combobox', { name: '직접 물어보기' }) as HTMLTextAreaElement
  return { input, submitDraft }
}

afterEach(cleanup)

describe('AskTab 섹션 질문 제안', () => {
  it('2자 이상 입력하면 맞는 섹션을 제안하고, 목차 밖 본문은 빼고 보인다', () => {
    const { input } = setup()
    fireEvent.change(input, { target: { value: '투자자' } })
    expect(input.getAttribute('aria-expanded')).toBe('true')
    const options = screen.getAllByRole('option')
    expect(options.map((o) => o.textContent)).toEqual([INVESTOR_QUESTION])
    expect(input.getAttribute('aria-controls')).toBe(screen.getByRole('listbox').id)
  })

  it('맞는 섹션이 없으면 제안 목록을 보이지 않는다', () => {
    const { input } = setup()
    fireEvent.change(input, { target: { value: '배당금' } })
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('↓로 고르고 Enter를 누르면 질문 문구로 채우고 닫으며 보내지 않는다', () => {
    const { input, submitDraft } = setup()
    fireEvent.change(input, { target: { value: '투자자' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    const option = screen.getByRole('option')
    expect(option.getAttribute('aria-selected')).toBe('true')
    expect(input.getAttribute('aria-activedescendant')).toBe(option.id)

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input.value).toBe(INVESTOR_QUESTION)
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(submitDraft).not.toHaveBeenCalled()

    fireEvent.keyDown(input, { key: 'Enter' })
    expect(submitDraft).toHaveBeenCalledTimes(1)
  })

  it('고른 제안이 없으면 Enter는 그대로 보낸다', () => {
    const { input, submitDraft } = setup()
    fireEvent.change(input, { target: { value: '투자자' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(submitDraft).toHaveBeenCalledTimes(1)
    expect(input.value).toBe('투자자')
  })

  it('Esc를 누르면 목록을 닫는다', () => {
    const { input } = setup()
    fireEvent.change(input, { target: { value: '사업' } })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(input.getAttribute('aria-expanded')).toBe('false')
    expect(input.getAttribute('aria-activedescendant')).toBeNull()
    expect(screen.queryByRole('option')).toBeNull()
  })

  it('제안을 누르면 질문 문구로 채운다', () => {
    const { input, submitDraft } = setup()
    fireEvent.change(input, { target: { value: '투자자' } })
    fireEvent.click(screen.getByRole('option'))
    expect(input.value).toBe(INVESTOR_QUESTION)
    expect(screen.queryByRole('option')).toBeNull()
    expect(submitDraft).not.toHaveBeenCalled()
  })
})

// 최신 순(questionId가 클수록 새것). 찾지 못한 답이라 카드가 단순하다
function answers(count: number): QuestionAnswer[] {
  return Array.from({ length: count }, (_, i) => {
    const id = count - i
    return {
      questionId: id,
      question: `질문 ${id}번은 무엇인가요?`,
      status: 'NOT_FOUND',
      answer: null,
      message: null,
      citations: [],
      facts: [],
      ai: null,
      feedback: null,
      createdAt: `2025-10-20T10:${String(id).padStart(2, '0')}:00+09:00`,
    }
  })
}

const answerCards = () => screen.getAllByRole('article').map((a) => a.getAttribute('aria-labelledby'))
const pastToggles = () => within(screen.getByRole('region', { name: /^이전 질문/ })).queryAllByRole('button', { name: /^질문/ })

describe('AskTab 지난 답 접기', () => {
  it('답이 21개면 최근 3개만 펼치고 나머지는 이전 질문 18개로 접는다', () => {
    render(<Harness submitDraft={noop} items={answers(21)} />)
    expect(answerCards()).toEqual(['ask-q-21', 'ask-q-20', 'ask-q-19'])
    expect(screen.getByRole('heading', { name: '이전 질문 18개' })).toBeTruthy()
    const toggles = pastToggles()
    expect(toggles).toHaveLength(18)
    expect(toggles[0].textContent).toContain('질문 18번은 무엇인가요?')
    expect(toggles[0].textContent).toContain('2025-10-20 10:18')
  })

  it('이전 질문을 누르면 그 답만 그 자리에 펼치고 다시 누르면 접는다', () => {
    render(<Harness submitDraft={noop} items={answers(21)} />)
    const toggle = within(screen.getByRole('region', { name: '이전 질문 18개' })).getByRole('button', { name: /질문 5번은/ })
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    const region = document.getElementById(toggle.getAttribute('aria-controls') ?? '')
    expect(region?.hidden).toBe(false)
    expect(region?.querySelector('article')?.getAttribute('aria-labelledby')).toBe('ask-q-5')
    expect(answerCards()).toHaveLength(4)

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(answerCards()).toHaveLength(3)
  })

  it('질문 찾기로 목록을 좁히고, 없으면 맞는 질문이 없다고 알린다', () => {
    render(<Harness submitDraft={noop} items={answers(21)} />)
    const search = screen.getByRole('searchbox', { name: '질문 찾기' })
    fireEvent.change(search, { target: { value: '질문 1 2번' } })
    expect(pastToggles().map((b) => b.textContent)).toEqual([expect.stringContaining('질문 12번')])
    fireEvent.change(search, { target: { value: '배당' } })
    expect(pastToggles()).toEqual([])
    expect(screen.getByText('맞는 질문이 없어요')).toBeTruthy()
  })

  it('이전 질문이 6개보다 적으면 질문 찾기를 두지 않는다', () => {
    render(<Harness submitDraft={noop} items={answers(8)} />)
    expect(screen.getByRole('heading', { name: '이전 질문 5개' })).toBeTruthy()
    expect(screen.queryByRole('searchbox')).toBeNull()
  })

  it('답이 3개 이하면 이전 질문 목록이 없다', () => {
    render(<Harness submitDraft={noop} items={answers(3)} />)
    expect(answerCards()).toHaveLength(3)
    expect(screen.queryByRole('heading', { name: /이전 질문/ })).toBeNull()
  })
})
