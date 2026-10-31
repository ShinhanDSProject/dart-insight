// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncFavoriteCompanies } from '@/shared/hooks/useFavoriteCompanies'
import { browserStorage, saveRecentAnalyses } from '@/shared/lib/recentAnalyses'
import type { Company } from '@/shared/api/companies'
import { AuthContext, type AuthContextValue } from '@/shared/auth/authContext'
import { axeViolations } from '@/test/axe'
import { SearchPage } from './SearchPage'

const companies: Company[] = [
  { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true },
  { corpCode: '00126371', corpName: '삼성전기', stockCode: '009150', listed: true },
  { corpCode: '00999999', corpName: '삼성 전자서비스', stockCode: null, listed: false },
]

/** 검색 API가 돌려줄 결과. 결과가 많은 경우를 보는 테스트만 바꾼다 */
let results: Company[] = companies

/** 결과가 많은 경우. 열두 곳이면 처음 10곳만 보이고 2곳이 접힌다 */
const manyCompanies: Company[] = Array.from({ length: 12 }, (_, i) => ({
  corpCode: String(10000000 + i),
  corpName: `삼성테스트${String(i + 1).padStart(2, '0')}`,
  stockCode: null,
  listed: false,
}))

vi.mock('@/shared/api/companies', () => ({
  searchCompanies: () => Promise.resolve({ items: results }),
}))

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
  results = companies
  featuredAvailable = false
  window.localStorage.clear()
  syncFavoriteCompanies(null)
})

// 관심 기업은 로그인한 회원만 쓴다. 이 테스트는 검색만 보므로 로그인하지 않은 상태로 그린다
const anonymous: AuthContextValue = { state: { status: 'anonymous' }, login: vi.fn(), logout: vi.fn() }

/** 둘러보기로 보낸 주소를 확인하는 자리 */
function ExploreProbe() {
  const location = useLocation()
  return <p>둘러보기 {location.search}</p>
}

function renderAt(query: string, auth: AuthContextValue = anonymous, entry = `/?q=${encodeURIComponent(query)}`) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/companies/:corpCode" element={<p>기업 화면</p>} />
          <Route path="/explore" element={<ExploreProbe />} />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

/** 결과 링크(접근 가능한 이름이 회사명으로 시작) */
function resultLink(name: RegExp) {
  return screen.getByRole('link', { name })
}

describe('검색 결과 키보드 이동(FS-32)', () => {
  it('입력창에서 ↓로 첫 결과로 가고 ↑↓로 옮기고 첫 결과의 ↑로 입력창에 돌아온다', async () => {
    renderAt('삼성')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    const input = screen.getByRole('textbox', { name: '회사명 또는 종목코드' })
    input.focus()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(resultLink(/^삼성전자/))

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(resultLink(/^삼성전기/))

    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(resultLink(/^삼성 전자서비스/))

    fireEvent.keyDown(document.activeElement!, { key: 'Home' })
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(input)
  })

  it('결과에서 Esc를 누르면 입력창으로 돌아온다', async () => {
    renderAt('삼성')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    const input = screen.getByRole('textbox', { name: '회사명 또는 종목코드' })
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
    expect(document.activeElement).toBe(input)
  })

  it('고른 결과는 실제 링크라 Enter로 기업 화면을 연다', async () => {
    renderAt('삼성')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    fireEvent.keyDown(screen.getByRole('textbox', { name: '회사명 또는 종목코드' }), { key: 'ArrowDown' })
    const link = document.activeElement as HTMLAnchorElement
    expect(link.getAttribute('href')).toBe('/companies/00126380')
    // jsdom은 링크의 Enter를 클릭으로 바꾸지 않으므로 브라우저가 하는 클릭을 대신 보낸다
    fireEvent.click(link)
    expect(await screen.findByText('기업 화면')).toBeTruthy()
  })
})

describe('검색어와 맞는 부분 강조(FS-32)', () => {
  it('초성 검색어면 삼성전자의 네 글자를 강조한다', async () => {
    renderAt('ㅅㅅㅈㅈ')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    const marks = resultLink(/^삼성전자/).querySelectorAll('mark')
    expect(Array.from(marks, (m) => m.textContent)).toEqual(['삼성전자'])
  })

  it('띄어 쓴 검색어도 붙여 쓴 이름을 강조한다', async () => {
    renderAt('삼성 전자')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    expect(Array.from(resultLink(/^삼성전자/).querySelectorAll('mark'), (m) => m.textContent)).toEqual(['삼성전자'])
    expect(Array.from(resultLink(/^삼성 전자서비스/).querySelectorAll('mark'), (m) => m.textContent)).toEqual(['삼성 전자'])
  })

  it('종목코드 검색어면 종목코드를 강조한다', async () => {
    renderAt('005930')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    expect(Array.from(resultLink(/^삼성전자/).querySelectorAll('mark'), (m) => m.textContent)).toEqual(['005930'])
  })

  it('검색 결과와 입력 안내에 접근성 위반이 없다', async () => {
    const { container } = renderAt('ㅅㅅㅈㅈ')
    await screen.findByRole('list', { name: '검색 결과 3곳' })
    expect(await axeViolations(container)).toBe('')
  })
})

describe('결과가 많을 때 접기', () => {
  it('결과가 10곳 이하이면 모두 보이고 더 보기 버튼이 없다', async () => {
    renderAt('삼성')
    const list = await screen.findByRole('list', { name: '검색 결과 3곳' })
    expect(within(list).getAllByRole('link')).toHaveLength(3)
    expect(screen.queryByRole('button', { name: /더 보기/ })).toBeNull()
  })

  it('결과가 10곳보다 많으면 처음 10곳만 보이고 더 보기로 펼치고 접기로 다시 접는다', async () => {
    results = manyCompanies
    renderAt('삼성')
    const list = await screen.findByRole('list', { name: '검색 결과 12곳' })
    expect(within(list).getAllByRole('link')).toHaveLength(10)
    expect(within(list).queryByRole('link', { name: /^삼성테스트11/ })).toBeNull()

    const more = screen.getByRole('button', { name: '더 보기 (2개)' })
    expect(more.getAttribute('aria-expanded')).toBe('false')
    expect(more.getAttribute('aria-controls')).toBe(list.id)

    fireEvent.click(more)
    expect(within(list).getAllByRole('link')).toHaveLength(12)
    const less = screen.getByRole('button', { name: '접기' })
    expect(less.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(less)
    expect(within(list).getAllByRole('link')).toHaveLength(10)
  })

  it('접혀 있으면 ↓·End로 숨은 결과에 가지 않고 열 번째 결과에서 멈춘다', async () => {
    results = manyCompanies
    renderAt('삼성')
    await screen.findByRole('list', { name: '검색 결과 12곳' })
    fireEvent.keyDown(screen.getByRole('textbox', { name: '회사명 또는 종목코드' }), { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(resultLink(/^삼성테스트10/))
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(resultLink(/^삼성테스트10/))
  })

  it('펼치면 ↓·End로 열한 번째부터 마지막 결과까지 간다', async () => {
    results = manyCompanies
    renderAt('삼성')
    await screen.findByRole('list', { name: '검색 결과 12곳' })
    fireEvent.click(screen.getByRole('button', { name: '더 보기 (2개)' }))
    fireEvent.keyDown(screen.getByRole('textbox', { name: '회사명 또는 종목코드' }), { key: 'ArrowDown' })
    fireEvent.keyDown(document.activeElement!, { key: 'End' })
    expect(document.activeElement).toBe(resultLink(/^삼성테스트12/))
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(resultLink(/^삼성테스트11/))
  })

  it('접힌 결과 목록과 더 보기 버튼에 접근성 위반이 없다', async () => {
    results = manyCompanies
    const { container } = renderAt('삼성')
    await screen.findByRole('list', { name: '검색 결과 12곳' })
    expect(await axeViolations(container)).toBe('')
  })
})

describe('검색 결과 카드(#549)', () => {
  it('결과는 검색 결과 N곳 카드 안에 기업 선택 행으로 보이고 아래에 다음 단계 안내가 있다', async () => {
    renderAt('삼성')
    const card = await screen.findByRole('region', { name: '검색 결과 3곳' })
    expect(within(card).getByRole('list', { name: '검색 결과 3곳' })).toBeTruthy()
    expect(within(card).getAllByText('기업 선택')).toHaveLength(3)
    expect(screen.getByText(/기업을 선택하면 정기보고서 목록에서 이전 보고서와 현재 보고서를 지정할 수 있어요/)).toBeTruthy()
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('DART Insight 기업 검색')
  })

  it('결과가 없어도 같은 카드 틀에 0곳과 다시 찾는 방법을 보인다', async () => {
    results = []
    const { container } = renderAt('없는회사')
    const card = await screen.findByRole('region', { name: '검색 결과 0곳' })
    expect(within(card).getByText("'없는회사'에 맞는 기업이 없습니다.")).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })
})


describe('첫 화면 검색창과 펼침 상자(#560, FS-67)', () => {
  const signedIn: AuthContextValue = { state: { status: 'authenticated', userId: 1 }, login: vi.fn(), logout: vi.fn() }

  it('비로그인 첫 화면은 탭 보드·즐겨찾기 카드 없이, 펼침 상자에 로그인 안내·예시 칩·둘러보기·사용법을 둔다', async () => {
    featuredAvailable = true
    const { container } = renderAt('')

    expect(screen.queryByRole('navigation', { name: '첫 화면 둘러보기' })).toBeNull()
    expect(screen.queryByRole('region', { name: '자주 찾는 기업 (즐겨찾기)' })).toBeNull()

    const examples = screen.getByRole('navigation', { name: '검색 예시' })
    expect(within(examples).getAllByRole('link').map((a) => a.textContent)).toEqual(['삼성전자', '에코프로비엠', '고려아연'])
    expect(within(examples).getByRole('link', { name: '에코프로비엠' }).getAttribute('href')).toBe(
      `/?q=${encodeURIComponent('에코프로비엠')}`,
    )
    expect(screen.getByText('관심 기업의 새 공시는 로그인하면 여기에 모여요')).toBeTruthy()
    expect(screen.getByRole('link', { name: '로그인' }).getAttribute('href')).toBe('/login')
    expect(screen.getByRole('link', { name: /둘러보기/ }).getAttribute('href')).toBe('/explore')
    expect(await axeViolations(container)).toBe('')
  })

  it('검색어를 넣으면 펼침 상자를 그리지 않는다(#560)', () => {
    renderAt('')
    const input = screen.getByRole('textbox', { name: '회사명 또는 종목코드' })
    fireEvent.change(input, { target: { value: '삼성' } })
    expect(screen.queryByText('관심 기업의 새 공시는 로그인하면 여기에 모여요')).toBeNull()
    expect(screen.queryByRole('navigation', { name: '검색 예시' })).toBeNull()
  })

  it('사용법 보기를 누르면 대화상자로 열고 Esc로 닫는다', async () => {
    const { container } = renderAt('')
    fireEvent.click(screen.getByRole('button', { name: '처음이신가요? 사용법 보기' }))
    const guideDialog = screen.getByRole('dialog', { name: '처음이신가요? 이렇게 써 보세요' })
    expect(within(guideDialog).getByRole('link', { name: '삼성전자로 해보기' }).getAttribute('href')).toBe(
      '/companies/00126380',
    )
    expect(await axeViolations(container)).toBe('')
    fireEvent.keyDown(guideDialog, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('회원이면 펼침 상자에 최근 본 분석과 자주 찾는 기업을 보이고, 검색어를 지우면 다시 첫 화면이다', async () => {
    saveRecentAnalyses(browserStorage(), [
      {
        analysisId: 12,
        corpName: '삼성전자',
        previousReportName: '사업보고서 (2024.12)',
        currentReportName: '사업보고서 (2025.12)',
        basisLabel: '전년 동기',
        viewedAt: '2026-10-26T10:00:00+09:00',
      },
    ])
    favoritesApi.getFavoriteCompanies.mockResolvedValue({ items: [{ ...companies[1], addedAt: '2026-10-26T10:00:00' }] })
    renderAt('', signedIn)

    expect(screen.getByRole('region', { name: '최근 본 분석' })).toBeTruthy()
    const favorites = await screen.findByRole('region', { name: '자주 찾는 기업' })
    expect(within(favorites).getByRole('link', { name: /삼성전기/ }).getAttribute('href')).toBe('/companies/00126371')
    expect(screen.queryByText('관심 기업의 새 공시는 로그인하면 여기에 모여요')).toBeNull()

    const input = screen.getByRole('textbox', { name: '회사명 또는 종목코드' }) as HTMLInputElement
    fireEvent.change(input, { target: { value: '삼성' } })
    fireEvent.click(screen.getByRole('button', { name: '검색어 지우기' }))
    expect(input.value).toBe('')
    expect(screen.getByRole('region', { name: '최근 본 분석' })).toBeTruthy()
  })

  it('예전 첫 화면 탭 주소(/?tab=)는 둘러보기로 보낸다', async () => {
    renderAt('', anonymous, '/?tab=season')
    expect(await screen.findByText('둘러보기 ?tab=season')).toBeTruthy()
  })
})
