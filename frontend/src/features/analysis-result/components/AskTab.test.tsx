// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { useReducer } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AskController } from '../hooks/useAsk'
import { askReducer, initialAskState } from '../model/askState'
import { AskTab } from './AskTab'

const sections = ['(목차 밖 본문)', 'I. 회사의 개요', 'II. 사업의 내용', 'XI. 그 밖에 투자자 보호를 위하여 필요한 사항']
const INVESTOR_QUESTION = "'XI. 그 밖에 투자자 보호를 위하여 필요한 사항'에서 무엇이 바뀌었나요?"
const noop = () => {}

// 입력창 글은 실제 reducer로 두고, 보내기만 바꿔 끼워 불렸는지 본다
function Harness({ submitDraft }: { submitDraft: () => void }) {
  const [state, dispatch] = useReducer(askReducer, initialAskState)
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
