// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCompactHeader } from './useCompactHeader'

type Callback = (entries: Partial<IntersectionObserverEntry>[]) => void

let notify: Callback = () => {}

class FakeIntersectionObserver {
  constructor(callback: Callback) {
    notify = callback
  }
  observe() {}
  disconnect() {}
}

function Probe() {
  const { sentinelRef, barRef, compact } = useCompactHeader<HTMLDivElement, HTMLDivElement>()
  return (
    <>
      <div ref={sentinelRef} />
      <div ref={barRef} data-testid="bar" data-compact={compact ? '' : undefined} />
    </>
  )
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('useCompactHeader', () => {
  it('센티넬이 화면 위로 나가면 접고, 다시 들어오면 편다', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    render(<Probe />)
    const bar = screen.getByTestId('bar')
    expect(bar.hasAttribute('data-compact')).toBe(false)

    act(() => notify([{ isIntersecting: false, boundingClientRect: { top: -10 } as DOMRectReadOnly }]))
    expect(bar.hasAttribute('data-compact')).toBe(true)

    act(() => notify([{ isIntersecting: true, boundingClientRect: { top: 20 } as DOMRectReadOnly }]))
    expect(bar.hasAttribute('data-compact')).toBe(false)
  })

  it('센티넬이 화면 아래쪽 밖에 있을 때는 접지 않는다', () => {
    vi.stubGlobal('IntersectionObserver', FakeIntersectionObserver)
    render(<Probe />)
    act(() => notify([{ isIntersecting: false, boundingClientRect: { top: 2000 } as DOMRectReadOnly }]))
    expect(screen.getByTestId('bar').hasAttribute('data-compact')).toBe(false)
  })

  it('관찰 API가 없는 브라우저에서는 접지 않는다', () => {
    vi.stubGlobal('IntersectionObserver', undefined)
    render(<Probe />)
    expect(screen.getByTestId('bar').hasAttribute('data-compact')).toBe(false)
  })
})
