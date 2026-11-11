// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSeasonChanges } from '../hooks/useSeasonChanges'
import { FEATURED_CHIPS, HomeLists } from './HomeLists'

const emptySeason = { season: null, seasons: [], computedAt: null, scoreVersion: 'season-1', candidateCount: 0, rankedCount: 0, excluded: { noReport: 0, failed: 0 }, items: [] }

const api = vi.hoisted(() => ({
  getFeaturedCompanies: vi.fn(() =>
    Promise.resolve({
      baseDate: '2026-10-24',
      source: '금융위원회, 공공데이터포털',
      items: [{ rank: 1, corpCode: '00126380', corpName: '삼성전자', stockCode: '005930' }],
    }),
  ),
  getSeasonChanges: vi.fn(),
  getServiceStats: vi.fn(() => Promise.resolve({ listedCompanies: 2814, completedAnalyses: 12, textChanges: 12950, countedAt: '2026-11-10T17:30:00' })),
}))
vi.mock('@/shared/api/featuredCompanies', () => ({ getFeaturedCompanies: api.getFeaturedCompanies }))
vi.mock('@/shared/api/seasonChanges', () => ({ getSeasonChanges: api.getSeasonChanges }))
vi.mock('@/shared/api/serviceStats', () => ({ getServiceStats: api.getServiceStats }))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

const featured = (count: number) => ({
  baseDate: '2026-10-24',
  source: '금융위원회, 공공데이터포털',
  items: Array.from({ length: count }, (_, i) => ({ rank: i + 1, corpCode: `0000000${i}`, corpName: `기업${i + 1}`, stockCode: '000000' })),
})

const season = (count: number) => ({
  ...emptySeason,
  season: { reportType: 'HALF', fiscalYear: 2026, previousFiscalYear: 2025 },
  items: Array.from({ length: count }, (_, i) => ({
    rank: i + 1,
    corpCode: `0010000${i}`,
    corpName: `시즌${i + 1}`,
    stockCode: null,
    previousRceptNo: null,
    currentRceptNo: null,
    changeCount: 100 - i,
    highlight: null,
    analysisId: null,
  })),
})

// 시즌 변화는 첫 화면(HomeHero)이 불러와 넘긴다
function Harness() {
  return <HomeLists season={useSeasonChanges(null)} favoritesStatus="anonymous" favorites={[]} onOpenGuide={() => {}} />
}

describe('첫 화면 세 칸(#686, #848, 동적 화면 시안)', () => {
  it('시즌 변화·숫자·대표 기업 세 칸을 바로 불러와 보인다', async () => {
    api.getSeasonChanges.mockResolvedValueOnce(emptySeason)
    render(<Harness />, { wrapper: MemoryRouter })
    expect(screen.getByRole('heading', { name: /^이번 시즌 변화가 큰 기업/ })).toBeTruthy()
    expect(screen.getByRole('heading', { name: '숫자로 보는 DART Insight' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: /^대표 기업/ })).toBeTruthy()
    const chips = await screen.findByRole('list', { name: '대표 기업' })
    expect(chips.querySelector('a')?.getAttribute('href')).toBe('/companies/00126380')
    expect(await screen.findByText(/이번 시즌 순위를 준비하고 있어요/)).toBeTruthy()
    expect(await screen.findByText('2,814곳')).toBeTruthy()
    expect(screen.getByText('12,950개')).toBeTruthy()
    expect(api.getSeasonChanges).toHaveBeenCalledTimes(1)
  })

  it('숫자를 못 불러오면 숫자만 숨기고 예시 비교 버튼은 남긴다', async () => {
    api.getSeasonChanges.mockResolvedValueOnce(emptySeason)
    api.getServiceStats.mockRejectedValueOnce(new Error('down'))
    render(<Harness />, { wrapper: MemoryRouter })
    await vi.waitFor(() => expect(screen.queryAllByText('불러오는 중이에요…')).toHaveLength(0))
    expect(screen.queryByText(/비교할 수 있는 상장 기업/)).toBeNull()
    expect(screen.getByRole('link', { name: '삼성전자로 바로 비교해 보기 →' })).toBeTruthy()
  })

  it(`대표 기업은 ${FEATURED_CHIPS}곳까지 칩으로 보인다`, async () => {
    api.getSeasonChanges.mockResolvedValueOnce(emptySeason)
    api.getFeaturedCompanies.mockResolvedValueOnce(featured(12))
    render(<Harness />, { wrapper: MemoryRouter })
    const chips = await screen.findByRole('list', { name: '대표 기업' })
    expect(chips.querySelectorAll('li')).toHaveLength(FEATURED_CHIPS)
  })

  it('시즌 변화는 처음엔 5개만 보이고 더 보기로 10개까지 펼치고 접는다', async () => {
    api.getSeasonChanges.mockResolvedValueOnce(season(12))
    render(<Harness />, { wrapper: MemoryRouter })
    const list = await screen.findByRole('list', { name: '이번 시즌 변화가 큰 기업' })
    expect(list.querySelectorAll('li')).toHaveLength(5)
    fireEvent.click(screen.getByRole('button', { name: '더 보기 (5개)' }))
    expect(screen.getByRole('list', { name: '이번 시즌 변화가 큰 기업' }).querySelectorAll('li')).toHaveLength(10)
    fireEvent.click(screen.getByRole('button', { name: '접기' }))
    expect(screen.getByRole('list', { name: '이번 시즌 변화가 큰 기업' }).querySelectorAll('li')).toHaveLength(5)
  })
})
