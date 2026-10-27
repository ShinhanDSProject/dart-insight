// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { FeaturedCompanyListResponse } from '@/shared/api/featuredCompanies'
import type { LoadState } from '@/shared/hooks/asyncState'
import { FEATURED_VISIBLE, FeaturedCompanies } from './FeaturedCompanies'

afterEach(cleanup)

function list(count: number): FeaturedCompanyListResponse {
  return {
    baseDate: '2026-10-24',
    source: '금융위원회, 공공데이터포털',
    items: Array.from({ length: count }, (_, i) => ({
      rank: i + 1,
      corpCode: String(i + 1).padStart(8, '0'),
      corpName: `기업${i + 1}`,
      stockCode: String(900000 + i),
    })),
  }
}

function renderWith(state: LoadState<FeaturedCompanyListResponse>, onRetry = vi.fn()) {
  render(
    <MemoryRouter>
      <FeaturedCompanies state={state} onRetry={onRetry} />
    </MemoryRouter>,
  )
  return onRetry
}

describe('FeaturedCompanies(#399)', () => {
  it('순서대로 처음 12곳을 보이고, 누르면 그 기업 화면으로 간다', () => {
    renderWith({ status: 'success', data: list(20) })
    const links = within(screen.getByRole('region', { name: '대표 기업' })).getAllByRole('link')
    expect(links).toHaveLength(FEATURED_VISIBLE)
    expect(links[0].textContent).toContain('기업1')
    expect(links[0].getAttribute('href')).toBe('/companies/00000001')
  })

  it('더 보기를 누르면 나머지를 펼친다', () => {
    renderWith({ status: 'success', data: list(20) })
    fireEvent.click(screen.getByRole('button', { name: '더 보기 (8곳)' }))
    expect(screen.getAllByRole('link')).toHaveLength(20)
  })

  it('기준일과 출처를 보이고, 시가총액 같은 숫자는 보이지 않는다', () => {
    renderWith({ status: 'success', data: list(3) })
    const section = screen.getByRole('region', { name: '대표 기업' })
    expect(section.textContent).toContain('2026.10.24 기준')
    expect(section.textContent).toContain('출처: 금융위원회, 공공데이터포털')
    expect(section.textContent).not.toMatch(/[0-9][0-9,]*\s*(원|조|억)/)
  })

  it('아직 받지 못했으면 빈 칸 대신 안내를 보인다', () => {
    renderWith({ status: 'success', data: { baseDate: null, source: '금융위원회, 공공데이터포털', items: [] } })
    expect(screen.getByText(/대표 기업 목록을 준비하고 있어요/)).toBeTruthy()
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })

  it('불러오지 못하면 다시 시도를 안내한다', () => {
    const onRetry = renderWith({ status: 'error', error: new Error('network') })
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
