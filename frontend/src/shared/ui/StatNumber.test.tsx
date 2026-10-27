// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Skeleton } from './Skeleton'
import { StatNumber } from './StatNumber'

const format = (value: number) => new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 }).format(value)

function reduceMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), media: query }))
}

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('StatNumber', () => {
  it('동작 줄이기면 처음부터 최종 값을 보인다', () => {
    reduceMotion(true)
    const { container } = render(<StatNumber label="매출액" value={1234} format={format} unit="원" />)
    expect(container.querySelector('.stat-number__digits')?.textContent).toBe('1,234')
  })

  it('움직이는 동안에도 화면 읽기 도구에는 최종 값을 읽어 준다', () => {
    reduceMotion(false)
    const { container } = render(<StatNumber label="매출액" value={1234} format={format} unit="원" />)
    expect(container.querySelector('.stat-number__digits')?.getAttribute('aria-hidden')).toBe('true')
    expect(container.querySelector('.visually-hidden')?.textContent).toBe('1,234원')
  })

  it('값이 없으면 0이 아니라 -와 자료 없음을 보인다', () => {
    reduceMotion(true)
    const { container } = render(<StatNumber label="영업이익" value={null} format={format} />)
    expect(screen.getByText('자료 없음')).toBeTruthy()
    expect(container.textContent).not.toContain('0')
  })

  it('증감은 ▲▼와 부호가 붙은 증감률, 방향 낱말로 보인다', () => {
    reduceMotion(true)
    const { container } = render(
      <StatNumber
        label="당기순이익"
        value={-50}
        format={format}
        change={{ direction: 'down', amount: '100억원', rate: '−12.5%' }}
      />,
    )
    const line = container.querySelector('.stat-number__change')?.textContent ?? ''
    expect(line).toContain('전기 대비')
    expect(line).toContain('▼')
    expect(line).toContain('감소')
    expect(line).toContain('100억원 (−12.5%)')
  })

  it('증감률을 계산하지 않았으면 사유 문구만 보인다', () => {
    reduceMotion(true)
    const { container } = render(<StatNumber label="영업이익" value={10} format={format} changeNote="전기 값이 없어요." />)
    expect(container.querySelector('.stat-number__change')?.textContent).toBe('전기 대비전기 값이 없어요.')
  })
})

describe('Skeleton', () => {
  it('불러오는 중임을 aria-busy와 보이지 않는 문구로 알리고 모양은 읽지 않는다', () => {
    render(<Skeleton label="요약을 불러오는 중입니다…" shape="card" count={3} />)
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.textContent).toBe('요약을 불러오는 중입니다…')
    expect(status.querySelectorAll('.skeleton__card[aria-hidden="true"]')).toHaveLength(3)
  })
})
