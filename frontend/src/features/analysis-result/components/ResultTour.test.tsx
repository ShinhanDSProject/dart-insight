// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { axeViolations } from '@/test/axe'
import { ResultTour } from './ResultTour'

afterEach(cleanup)

function show() {
  const onGoTab = vi.fn()
  const onOpenChat = vi.fn()
  const onFinish = vi.fn()
  const view = render(<ResultTour onGoTab={onGoTab} onOpenChat={onOpenChat} onFinish={onFinish} />)
  return { ...view, onGoTab, onOpenChat, onFinish }
}

describe('결과 화면 둘러보기(#842)', () => {
  it('요약부터 시작하고, 다음을 누르면 문장 변화 탭으로 옮기며 이전으로 돌아온다', async () => {
    const { container, onGoTab } = show()
    expect(screen.getByRole('heading', { name: '1 / 3 요약부터 보세요' })).toBeTruthy()
    expect(screen.queryByRole('button', { name: '이전' })).toBeNull()
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByRole('heading', { name: '2 / 3 문장 변화에서 그사이 한 일을 보세요' })).toBeTruthy()
    expect(onGoTab).toHaveBeenLastCalledWith('activity')

    fireEvent.click(screen.getByRole('button', { name: '이전' }))
    expect(onGoTab).toHaveBeenLastCalledWith('summary')
  })

  it('마지막 단계에서 AI 에이전트를 열고 끝내며, 건너뛰기도 끝낸다', () => {
    const { onOpenChat, onFinish } = show()
    fireEvent.click(screen.getByRole('button', { name: '건너뛰기' }))
    expect(onFinish).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    fireEvent.click(screen.getByRole('button', { name: '다음' }))
    expect(screen.getByRole('heading', { name: '3 / 3 궁금하면 AI 에이전트에게 물어보세요' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'AI 에이전트 열기' }))
    expect(onOpenChat).toHaveBeenCalledTimes(1)
    expect(onFinish).toHaveBeenCalledTimes(2)
  })
})
