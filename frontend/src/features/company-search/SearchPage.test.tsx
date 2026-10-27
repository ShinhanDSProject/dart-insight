// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { syncFavoriteCompanies } from '@/shared/hooks/useFavoriteCompanies'
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

// 관심 기업 새 공시(FS-52)는 컴포넌트 테스트에서 따로 본다
vi.mock('@/shared/api/disclosures', () => ({
  listDisclosures: (corpCode: string) =>
    Promise.resolve({ corpCode, days: 30, from: '2026-09-26', to: '2026-10-26', fetchedAt: null, refreshError: null, groups: [], items: [] }),
}))

afterEach(() => {
  cleanup()
  results = companies
  syncFavoriteCompanies(null)
})

// 관심 기업은 로그인한 회원만 쓴다. 이 테스트는 검색만 보므로 로그인하지 않은 상태로 그린다
const anonymous: AuthContextValue = { state: { status: 'anonymous' }, login: vi.fn(), logout: vi.fn() }

function renderAt(query: string, auth: AuthContextValue = anonymous) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[`/?q=${encodeURIComponent(query)}`]}>
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/companies/:corpCode" element={<p>기업 화면</p>} />
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

describe('관심 기업(#36)', () => {
  const signedIn: AuthContextValue = { state: { status: 'authenticated', userId: 1 }, login: vi.fn(), logout: vi.fn() }

  it('목록을 받지 못하면 빈 목록처럼 숨기지 않고 안내하며, 다시 시도하면 목록을 보인다', async () => {
    favoritesApi.getFavoriteCompanies
      .mockRejectedValueOnce(new Error('network'))
      .mockResolvedValueOnce({ items: [{ ...companies[0], addedAt: '2026-10-26T10:00:00' }] })
    renderAt('', signedIn)
    expect((await screen.findByRole('alert')).textContent).toContain('관심 기업을 불러오지 못했어요')
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    const section = await screen.findByRole('region', { name: '관심 기업' })
    expect(within(section).getByRole('link', { name: /삼성전자/ })).toBeTruthy()
  })
})
