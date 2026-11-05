// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { HomeLists } from './HomeLists'

const api = vi.hoisted(() => ({
  getFeaturedCompanies: vi.fn(() =>
    Promise.resolve({
      baseDate: '2026-10-24',
      source: '금융위원회, 공공데이터포털',
      items: [{ rank: 1, corpCode: '00126380', corpName: '삼성전자', stockCode: '005930' }],
    }),
  ),
  getSeasonChanges: vi.fn(() =>
    Promise.resolve({ season: null, seasons: [], computedAt: null, scoreVersion: 'season-1', candidateCount: 0, rankedCount: 0, excluded: { noReport: 0, failed: 0 }, items: [] }),
  ),
}))
vi.mock('@/shared/api/featuredCompanies', () => ({ getFeaturedCompanies: api.getFeaturedCompanies }))
vi.mock('@/shared/api/seasonChanges', () => ({ getSeasonChanges: api.getSeasonChanges }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

function toggle(label: string) {
  const summary = screen.getByText(label)
  const details = summary.closest('details')!
  details.open = !details.open
  fireEvent(details, new Event('toggle'))
}

describe('첫 화면 접는 목록(#686)', () => {
  it('접혀 있는 동안에는 대표 기업·시즌 변화를 불러오지 않는다', () => {
    render(<HomeLists favoritesStatus="anonymous" favorites={[]} />, { wrapper: MemoryRouter })
    expect(screen.getByText('대표 기업')).toBeTruthy()
    expect(screen.getByText('이번 시즌 변화가 큰 기업 Top 10')).toBeTruthy()
    expect(api.getFeaturedCompanies).not.toHaveBeenCalled()
    expect(api.getSeasonChanges).not.toHaveBeenCalled()
  })

  it('대표 기업을 펼치면 그 목록만 불러와 기업 링크를 보인다', async () => {
    render(<HomeLists favoritesStatus="anonymous" favorites={[]} />, { wrapper: MemoryRouter })
    toggle('대표 기업')
    const list = await screen.findByRole('list', { name: '대표 기업' })
    expect(list.querySelector('a')?.getAttribute('href')).toBe('/companies/00126380')
    expect(api.getFeaturedCompanies).toHaveBeenCalledTimes(1)
    expect(api.getSeasonChanges).not.toHaveBeenCalled()
  })

  it('시즌 변화를 펼치면 시즌 변화를 불러온다', async () => {
    render(<HomeLists favoritesStatus="anonymous" favorites={[]} />, { wrapper: MemoryRouter })
    toggle('이번 시즌 변화가 큰 기업 Top 10')
    expect(await screen.findByText(/이번 시즌 순위를 준비하고 있어요/)).toBeTruthy()
    expect(api.getSeasonChanges).toHaveBeenCalledTimes(1)
  })
})
