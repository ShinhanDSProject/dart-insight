// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Tabs } from './Tabs'

const items = [
  { value: 'summary', label: '요약' },
  { value: 'financial', label: '재무 수치' },
] as const

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Tabs 밑줄', () => {
  it('탭 위치를 재지 못하면 옮기는 밑줄을 쓰지 않고 고른 탭의 자기 밑줄을 둔다', () => {
    render(<Tabs label="결과 탭" items={items} value="summary" onChange={() => {}} />)
    const nav = screen.getByRole('navigation', { name: '결과 탭' })
    expect(nav.dataset.indicator).toBeUndefined()
    expect(nav.querySelector('.tabs__indicator')?.getAttribute('aria-hidden')).toBe('true')
  })

  it('고른 탭이 바뀌면 밑줄 하나를 그 탭의 자리와 너비로 옮긴다', () => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockImplementation(function (this: HTMLElement) {
      return this.textContent === '재무 수치' ? 80 : 40
    })
    vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockImplementation(function (this: HTMLElement) {
      return this.textContent === '재무 수치' ? 68 : 0
    })
    const { rerender } = render(<Tabs label="결과 탭" items={items} value="summary" onChange={() => {}} />)
    const nav = screen.getByRole('navigation', { name: '결과 탭' })
    const indicator = nav.querySelector<HTMLElement>('.tabs__indicator')
    expect(nav.dataset.indicator).toBe('ready')
    expect(indicator?.style.width).toBe('40px')

    rerender(<Tabs label="결과 탭" items={items} value="financial" onChange={() => {}} />)
    expect(indicator?.style.width).toBe('80px')
    expect(indicator?.style.transform).toBe('translateX(68px)')
  })
})
