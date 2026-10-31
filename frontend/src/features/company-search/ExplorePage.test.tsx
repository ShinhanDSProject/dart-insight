// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncFavoriteCompanies } from '@/shared/hooks/useFavoriteCompanies'
import type { Company } from '@/shared/api/companies'
import { AuthContext, type AuthContextValue } from '@/shared/auth/authContext'
import { axeViolations } from '@/test/axe'
import { ExplorePage } from './ExplorePage'

const companies: Company[] = [
  { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true },
  { corpCode: '00126371', corpName: '삼성전기', stockCode: '009150', listed: true },
  { corpCode: '00999999', corpName: '삼성 전자서비스', stockCode: null, listed: false },
]

const favoritesApi = vi.hoisted(() => ({
  getFavoriteCompanies: vi.fn(),
  addFavoriteCompany: vi.fn(),
  removeFavoriteCompany: vi.fn(),
}))
vi.mock('@/shared/api/favoriteCompanies', () => favoritesApi)
const featuredItems = [
  { rank: 1, corpCode: '00126380', corpName: '삼성전자', stockCode: '005930' },
  { rank: 2, corpCode: '00164779', corpName: 'SK하이닉스', stockCode: '000660' },
]
let featuredAvailable = false

vi.mock('@/shared/api/featuredCompanies', () => ({
  getFeaturedCompanies: () =>
    Promise.resolve({
      baseDate: featuredAvailable ? '2026-10-24' : null,
      source: '금융위원회, 공공데이터포털',
      items: featuredAvailable ? featuredItems : [],
    }),
}))
// 이번 시즌 변화가 큰 기업(#420)은 컴포넌트 테스트에서 따로 본다
vi.mock('@/shared/api/seasonChanges', () => ({
  getSeasonChanges: () =>
    Promise.resolve({ season: null, seasons: [], computedAt: null, scoreVersion: 'season-1', candidateCount: 0, rankedCount: 0, excluded: { noReport: 0, failed: 0 }, items: [] }),
}))

// 관심 기업 새 공시(FS-52)는 컴포넌트 테스트에서 따로 본다
vi.mock('@/shared/api/disclosures', () => ({
  listDisclosures: (corpCode: string) =>
    Promise.resolve({ corpCode, days: 30, from: '2026-09-26', to: '2026-10-26', fetchedAt: null, refreshError: null, groups: [], items: [] }),
}))

afterEach(() => {
  cleanup()
  featuredAvailable = false
  window.localStorage.clear()
  syncFavoriteCompanies(null)
})

const anonymous: AuthContextValue = { state: { status: 'anonymous' }, login: vi.fn(), logout: vi.fn() }
const signedIn: AuthContextValue = { state: { status: 'authenticated', userId: 1 }, login: vi.fn(), logout: vi.fn() }

function renderExplore(auth: AuthContextValue = anonymous, entry = '/explore') {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/" element={<p>첫 화면</p>} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('둘러보기 탭 보드(FS-67, 예전 첫 화면 #538·#549·#560)', () => {
  it('비로그인이면 시즌·대표 기업 두 탭과 로그인 안내 한 줄만 보이고 빈 즐겨찾기 상자를 두지 않는다', async () => {
    featuredAvailable = true
    const { container } = renderExplore()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('둘러보기')
    const shelfTabs = screen.getByRole('navigation', { name: '둘러보기' })
    expect(within(shelfTabs).getAllByRole('button').map((b) => b.textContent)).toEqual(['이번 시즌 변화', '대표 기업'])
    expect(screen.getByText('관심 기업의 새 공시는 로그인하면 여기에 모여요')).toBeTruthy()
    expect(screen.getByRole('link', { name: '로그인' }).getAttribute('href')).toBe('/login')
    expect(screen.queryByRole('region', { name: '자주 찾는 기업 (즐겨찾기)' })).toBeNull()

    fireEvent.click(within(shelfTabs).getByRole('button', { name: '대표 기업' }))
    expect(await screen.findByRole('region', { name: '대표 기업' })).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('주소의 ?tab으로 고른 탭을 연다', async () => {
    featuredAvailable = true
    renderExplore(anonymous, '/explore?tab=featured')
    expect(await screen.findByRole('region', { name: '대표 기업' })).toBeTruthy()
  })

  it('관심 기업이 있는 회원은 새 공시 탭을 앞에 둔다', async () => {
    favoritesApi.getFavoriteCompanies.mockResolvedValue({ items: [{ ...companies[0], addedAt: '2026-10-26T10:00:00' }] })
    renderExplore(signedIn)
    await screen.findByRole('region', { name: '자주 찾는 기업 (즐겨찾기)' })
    const shelfTabs = screen.getByRole('navigation', { name: '둘러보기' })
    expect(within(shelfTabs).getAllByRole('button').map((b) => b.textContent)).toEqual([
      '관심 기업 새 공시',
      '이번 시즌 변화',
      '대표 기업',
    ])
  })
})

describe('관심 기업(#36)', () => {
  it('목록을 받지 못하면 빈 목록처럼 숨기지 않고 안내하며, 다시 시도하면 목록을 보인다', async () => {
    favoritesApi.getFavoriteCompanies
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ items: [{ ...companies[0], addedAt: '2026-10-26T10:00:00' }] })
    renderExplore(signedIn)
    expect((await screen.findByRole('alert')).textContent).toContain('관심 기업을 불러오지 못했어요')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    const section = await screen.findByRole('region', { name: '자주 찾는 기업 (즐겨찾기)' })
    expect(within(section).getByRole('link', { name: /삼성전자/ })).toBeTruthy()
  })
})

describe('자주 찾는 기업 카드(#549)', () => {
  it('관심 기업을 개수와 칩으로 보이고 기업 추가를 누르면 첫 화면 검색으로 간다', async () => {
    favoritesApi.getFavoriteCompanies.mockResolvedValue({
      items: [
        { ...companies[0], addedAt: '2026-10-26T10:00:00' },
        { ...companies[1], addedAt: '2026-10-25T10:00:00' },
      ],
    })
    const { container } = renderExplore(signedIn)
    const card = await screen.findByRole('region', { name: '자주 찾는 기업 (즐겨찾기)' })
    expect(within(card).getByText('2')).toBeTruthy()
    expect(within(card).getByRole('link', { name: /^삼성전자/ }).getAttribute('href')).toBe('/companies/00126380')
    expect(within(card).getByRole('button', { name: '삼성전기 관심 기업에서 빼기' })).toBeTruthy()
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(within(card).getByRole('button', { name: '+ 기업 추가' }))
    expect(await screen.findByText('첫 화면')).toBeTruthy()
  })

  it('관심 기업이 없으면 별로 더하는 방법을 알린다', async () => {
    favoritesApi.getFavoriteCompanies.mockResolvedValue({ items: [] })
    renderExplore(signedIn)
    const card = await screen.findByRole('region', { name: '자주 찾는 기업 (즐겨찾기)' })
    expect(within(card).getByText(/별을 누르면 자주 찾는 기업으로 여기에 모여요/)).toBeTruthy()
  })
})
