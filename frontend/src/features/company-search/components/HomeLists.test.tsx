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

const featured = (count: number) => ({
  baseDate: '2026-10-24',
  source: '금융위원회, 공공데이터포털',
  items: Array.from({ length: count }, (_, i) => ({ rank: i + 1, corpCode: `0000000${i}`, corpName: `기업${i + 1}`, stockCode: '000000' })),
})

describe('첫 화면 두 칸 목록(#686, #848)', () => {
  it('접지 않고 대표 기업과 시즌 변화를 바로 불러와 두 칸으로 보인다', async () => {
    render(<HomeLists favoritesStatus="anonymous" favorites={[]} />, { wrapper: MemoryRouter })
    expect(screen.getByRole('heading', { name: /^대표 기업/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /^이번 시즌 변화가 큰 기업/ })).toBeTruthy()
    const list = await screen.findByRole('list', { name: '대표 기업' })
    expect(list.querySelector('a')?.getAttribute('href')).toBe('/companies/00126380')
    expect(await screen.findByText(/이번 시즌 순위를 준비하고 있어요/)).toBeTruthy()
    expect(api.getFeaturedCompanies).toHaveBeenCalledTimes(1)
    expect(api.getSeasonChanges).toHaveBeenCalledTimes(1)
  })

  it('처음엔 5개만 보이고 더 보기로 10개까지 펼치고 접는다', async () => {
    api.getFeaturedCompanies.mockResolvedValueOnce(featured(12))
    render(<HomeLists favoritesStatus="anonymous" favorites={[]} />, { wrapper: MemoryRouter })
    const list = await screen.findByRole('list', { name: '대표 기업' })
    expect(list.querySelectorAll('li')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: '더 보기 (5개)' }))
    expect(screen.getByRole('list', { name: '대표 기업' }).querySelectorAll('li')).toHaveLength(10)
    fireEvent.click(screen.getByRole('button', { name: '접기' }))
    expect(screen.getByRole('list', { name: '대표 기업' }).querySelectorAll('li')).toHaveLength(5)
  })
})
