// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useRevealReady } from '@/shared/hooks/useRevealReady'
import { REVEAL_ENTER_MS, REVEAL_MAX_WAIT_MS } from '@/shared/lib/pageReveal'
import { PageReveal } from './PageReveal'

function Section({ settled }: { settled: boolean }) {
  useRevealReady(settled)
  return <p>{settled ? '내용' : '불러오는 중'}</p>
}

function renderPage(sections: boolean[]) {
  const ui = (values: boolean[]) => (
    <PageReveal fallback={<p>화면 모양</p>}>
      {values.map((settled, i) => (
        <Section key={i} settled={settled} />
      ))}
    </PageReveal>
  )
  const view = render(ui(sections))
  return { ...view, update: (next: boolean[]) => view.rerender(ui(next)) }
}

function revealRoot(container: HTMLElement) {
  return container.querySelector('.page-reveal')
}

function isWaiting(container: HTMLElement) {
  return revealRoot(container)?.classList.contains('page-reveal--waiting') ?? false
}

describe('PageReveal', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    delete document.documentElement.dataset.intro
    delete document.documentElement.dataset.introReady
  })

  it('모든 칸이 이미 응답했으면 화면 모양 없이 바로 보인다', () => {
    const { container } = renderPage([true, true])
    expect(isWaiting(container)).toBe(false)
    expect(screen.queryByText('화면 모양')).toBeNull()
  })

  it('응답을 기다리는 칸이 있으면 내용을 가리고 화면 모양을 보인다', () => {
    const { container } = renderPage([true, false])
    expect(isWaiting(container)).toBe(true)
    expect(revealRoot(container)?.getAttribute('aria-busy')).toBe('true')
    expect(screen.queryByText('화면 모양')).not.toBeNull()
  })

  it('마지막 칸이 응답하면 한 번에 보인다', () => {
    const { container, update } = renderPage([true, false])
    update([true, true])
    expect(isWaiting(container)).toBe(false)
    expect(screen.queryByText('화면 모양')).toBeNull()
  })

  it('최대 대기 시간이 지나면 아직 불러오는 칸이 있어도 보인다', () => {
    const { container } = renderPage([false])
    act(() => vi.advanceTimersByTime(REVEAL_MAX_WAIT_MS))
    expect(isWaiting(container)).toBe(false)
    expect(screen.queryByText('불러오는 중')).not.toBeNull()
  })

  it('한 번 보인 뒤 다시 불러오는 칸이 생겨도 가리지 않는다', () => {
    const { container, update } = renderPage([true])
    update([false])
    expect(isWaiting(container)).toBe(false)
  })

  it('보인 뒤 잠깐 차례로 떠오르는 단계를 거쳐 다 보인 상태가 된다', () => {
    const { container } = renderPage([true])
    expect(revealRoot(container)?.classList.contains('page-reveal--entering')).toBe(true)
    act(() => vi.advanceTimersByTime(REVEAL_ENTER_MS))
    expect(revealRoot(container)?.classList.contains('page-reveal--shown')).toBe(true)
  })

  it('발표에서 넘어온 첫 화면이어도 응답을 기다렸다가 보인다', () => {
    document.documentElement.dataset.intro = 'skip'
    const { container, update } = renderPage([false])
    expect(isWaiting(container)).toBe(true)
    expect(document.documentElement.dataset.introReady).toBeUndefined()
    update([true])
    expect(isWaiting(container)).toBe(false)
    // 화면 전체 가림(index.html)을 풀도록 알린다
    expect(document.documentElement.dataset.introReady).toBe('')
  })
})
