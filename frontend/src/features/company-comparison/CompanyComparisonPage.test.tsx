// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Company } from '@/shared/api/companies'
import type { FinancialTrend, FsDiv, TrendPeriod } from '@/shared/api/financialTrends'
import { ApiError } from '@/shared/api/client'
import { AuthContext, type AuthContextValue } from '@/shared/auth/authContext'
import { syncFavoriteCompanies } from '@/shared/hooks/useFavoriteCompanies'
import { axeViolations } from '@/test/axe'
import { CompanyComparisonPage } from './CompanyComparisonPage'

const companies: Record<string, Company> = {
  '00126380': { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true },
  '00164779': { corpCode: '00164779', corpName: 'SK하이닉스', stockCode: '000660', listed: true },
  '00000003': { corpCode: '00000003', corpName: '셋째기업', stockCode: null, listed: false },
  '00000004': { corpCode: '00000004', corpName: '넷째기업', stockCode: null, listed: false },
  '00000005': { corpCode: '00000005', corpName: '다섯째기업', stockCode: null, listed: false },
}

const api = vi.hoisted(() => ({
  searchCompanies: vi.fn(),
  getCompany: vi.fn(),
  getFinancialTrends: vi.fn<(corpCode: string, fsDiv: FsDiv, signal?: AbortSignal) => Promise<FinancialTrend>>(),
}))

vi.mock('@/shared/api/companies', () => ({
  searchCompanies: api.searchCompanies,
  getCompany: api.getCompany,
}))
vi.mock('@/shared/api/financialTrends', () => ({ getFinancialTrends: api.getFinancialTrends }))

const favoritesApi = vi.hoisted(() => ({
  getFavoriteCompanies: vi.fn(),
  addFavoriteCompany: vi.fn(),
  removeFavoriteCompany: vi.fn(),
}))
vi.mock('@/shared/api/favoriteCompanies', () => favoritesApi)

function period(rceptNo: string, reportType: TrendPeriod['reportType'], periodEnd: string): TrendPeriod {
  return {
    rceptNo,
    reportType,
    reportName: `${reportType === 'ANNUAL' ? '사업보고서' : '반기보고서'} (${periodEnd.slice(0, 7).replace('-', '.')})`,
    fiscalYear: Number(periodEnd.slice(0, 4)),
    periodEnd,
    dataStatus: 'AVAILABLE',
    sourceRceptNo: rceptNo,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

function annualTrend(corpCode: string, periodEnd = '2025-12-31', rceptNo = `2026031${corpCode.slice(-7)}`): FinancialTrend {
  const periods = [period(rceptNo, 'ANNUAL', periodEnd)]
  const value = (amount: number | null) => [{ rceptNo, amount, quarterAmount: null, currency: amount === null ? null : 'KRW' }]
  return {
    corpCode,
    fsDiv: 'CFS',
    refreshError: null,
    periods,
    accounts: [
      { key: 'REVENUE', name: '매출액', sjDiv: 'IS', amountBasis: 'CUMULATIVE', values: value(300_000_000_000_000) },
      { key: 'OPERATING_INCOME', name: '영업이익', sjDiv: 'IS', amountBasis: 'CUMULATIVE', values: value(30_000_000_000_000) },
      { key: 'NET_INCOME', name: '당기순이익', sjDiv: 'IS', amountBasis: 'CUMULATIVE', values: value(null) },
      { key: 'TOTAL_ASSETS', name: '자산총계', sjDiv: 'BS', amountBasis: 'POINT', values: value(500_000_000_000_000) },
      { key: 'TOTAL_LIABILITIES', name: '부채총계', sjDiv: 'BS', amountBasis: 'POINT', values: value(100_000_000_000_000) },
      { key: 'TOTAL_EQUITY', name: '자본총계', sjDiv: 'BS', amountBasis: 'POINT', values: value(400_000_000_000_000) },
    ],
  }
}

let trends: Record<string, () => Promise<FinancialTrend>>

beforeEach(() => {
  trends = {}
  api.searchCompanies.mockImplementation((query: string) =>
    Promise.resolve({ items: Object.values(companies).filter((c) => c.corpName.includes(query) || query === '기업들') }),
  )
  api.getCompany.mockImplementation((corpCode: string) => Promise.resolve(companies[corpCode]))
  api.getFinancialTrends.mockImplementation((corpCode: string) =>
    (trends[corpCode] ?? (() => Promise.resolve(annualTrend(corpCode))))(),
  )
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  syncFavoriteCompanies(null)
  vi.clearAllMocks()
})

const anonymous: AuthContextValue = { state: { status: 'anonymous' }, login: vi.fn(), logout: vi.fn() }

function Location() {
  const { search } = useLocation()
  return <output data-testid="location">{search}</output>
}

function renderAt(search: string, auth: AuthContextValue = anonymous) {
  return render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[`/compare/companies${search}`]}>
        <Routes>
          <Route
            path="/compare/companies"
            element={
              <>
                <CompanyComparisonPage />
                <Location />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

const location = () => decodeURIComponent(screen.getByTestId('location').textContent ?? '')

async function search(text: string) {
  vi.useFakeTimers()
  fireEvent.change(screen.getByLabelText('기업 더하기'), { target: { value: text } })
  await act(async () => {
    await vi.advanceTimersByTimeAsync(300)
  })
  vi.useRealTimers()
}

describe('여러 기업 나란히 보기', () => {
  it('2곳보다 적으면 고르는 방법을 같은 자리에 안내하고, 표 틀(4칸)은 그대로 둔다', async () => {
    renderAt('?corps=00126380')
    expect(screen.getByText(/비교할 기업을 2곳 이상 골라 주세요/)).toBeTruthy()
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('columnheader')).toHaveLength(5)
    expect(within(table).getAllByText('기업을 더해 주세요')).toHaveLength(3)
    expect(await screen.findByRole('button', { name: '삼성전자 빼기' })).toBeTruthy()
  })

  it('주소의 기업을 고른 순서대로 열에 놓고 주요계정·비율·근거 보고서를 보여 준다', async () => {
    const { container } = renderAt('?corps=00164779,00126380')
    const table = await screen.findByRole('table')
    await within(table).findByText('삼성전자')
    const headers = within(table).getAllByRole('columnheader')
    // 고르지 않은 자리도 빈 열로 남겨, 기업 수가 바뀌어도 열 폭이 그대로다(#424)
    expect(headers.map((h) => h.querySelector('.company-compare__name')?.textContent ?? h.textContent)).toEqual([
      '항목',
      'SK하이닉스',
      '삼성전자',
      '기업을 더해 주세요',
      '기업을 더해 주세요',
    ])
    expect(within(headers[2]).getByText('사업보고서 (2025.12)')).toBeTruthy()
    expect(within(headers[2]).getByText('2025 사업연도 (2025.01.01 ~ 2025.12.31)')).toBeTruthy()
    expect(within(headers[2]).getByText(/접수번호 20260310126380/)).toBeTruthy()
    expect(
      within(headers[2]).getByRole('link', { name: '삼성전자 사업보고서 (2025.12)(접수번호 20260310126380) DART 원문 새 창으로 열기' }),
    ).toBeTruthy()

    const revenue = within(table).getByRole('row', { name: /^매출액/ })
    expect(within(revenue).getAllByText('300조원')).toHaveLength(2)
    const netIncome = within(table).getByRole('row', { name: /^당기순이익/ })
    expect(within(netIncome).getAllByText('자료 없음')).toHaveLength(2)
    const debt = within(table).getByRole('row', { name: /^부채비율/ })
    expect(within(debt).getAllByText('25.0%')).toHaveLength(2)
    const netMargin = within(table).getByRole('row', { name: /^순이익률/ })
    expect(within(netMargin).getAllByText('계산 불가 · 당기순이익 미기재')).toHaveLength(2)

    expect(api.getFinancialTrends).toHaveBeenCalledWith('00164779', 'CFS', expect.any(AbortSignal))
    expect(api.getFinancialTrends).toHaveBeenCalledWith('00126380', 'CFS', expect.any(AbortSignal))
    expect(screen.queryByText(/대상 기간이 달라요/)).toBeNull()
    expect(await axeViolations(container)).toBe('')
  })

  it('정렬 버튼이나 순위·최고·최저 표시를 두지 않는다', async () => {
    renderAt('?corps=00164779,00126380')
    const table = await screen.findByRole('table')
    await within(table).findByText('삼성전자')
    expect(table.querySelector('[aria-sort]')).toBeNull()
    expect(within(table).queryByRole('button', { name: /정렬/ })).toBeNull()
    expect(table.textContent).not.toMatch(/순위|최고|최저|1위|우수|저평가/)
  })

  it('대상 기간이 다르면 기간이 다르다고 알리고 열마다 기간을 그대로 보여 준다', async () => {
    trends['00164779'] = () => Promise.resolve(annualTrend('00164779', '2026-03-31', '20260620000001'))
    renderAt('?corps=00126380,00164779')
    expect(await screen.findByText(/대상 기간이 달라요 · 기업마다 표시한 기간을 확인해 주세요/)).toBeTruthy()
    expect(screen.getByText('2025 사업연도 (2025.01.01 ~ 2025.12.31)')).toBeTruthy()
    expect(screen.getByText('2026 사업연도 (2026.01.01 ~ 2026.03.31)')).toBeTruthy()
  })

  it('한 기업을 불러오지 못하면 그 열만 실패를 보여 주고 다시 시도하면 그 기업만 다시 부른다', async () => {
    let calls = 0
    trends['00164779'] = () => {
      calls += 1
      return calls === 1
        ? Promise.reject(new ApiError(502, { code: 'DART_REQUEST_FAILED', message: '실패', traceId: 't', errors: [] }))
        : Promise.resolve(annualTrend('00164779'))
    }
    renderAt('?corps=00126380,00164779')
    expect(await screen.findByText('불러오지 못했어요')).toBeTruthy()
    expect(screen.getAllByText('300조원')).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'SK하이닉스 다시 시도' }))
    await waitFor(() => expect(screen.getAllByText('300조원')).toHaveLength(2))
    expect(api.getFinancialTrends.mock.calls.filter(([corp]) => corp === '00126380')).toHaveLength(1)
    expect(api.getFinancialTrends.mock.calls.filter(([corp]) => corp === '00164779')).toHaveLength(2)
  })

  it('고른 종류 보고서가 없는 기업은 그 열에만 사유와 다른 종류를 고르라는 안내를 보여 준다', async () => {
    const { container } = renderAt('?corps=00126380,00164779&type=HALF')
    expect(await screen.findAllByText('고른 종류의 보고서가 없어요')).toHaveLength(2)
    expect(screen.getAllByText('반기보고서가 없는 기업이에요. 다른 보고서 종류를 골라 보세요.')).toHaveLength(2)
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '사업보고서' }))
    await waitFor(() => expect(screen.getAllByText('300조원')).toHaveLength(2))
    expect(location()).toContain('type=ANNUAL')
    // 보고서 종류만 바꾸면 다시 부르지 않는다(같은 응답에서 고름)
    expect(api.getFinancialTrends).toHaveBeenCalledTimes(2)
  })

  it('검색으로 기업을 더하고 빼면 주소에 고른 순서대로 남는다', async () => {
    renderAt('')
    await search('삼성')
    fireEvent.click(await screen.findByRole('button', { name: '삼성전자 더하기' }))
    expect(location()).toBe('?corps=00126380')
    await search('SK')
    fireEvent.click(await screen.findByRole('button', { name: 'SK하이닉스 더하기' }))
    expect(location()).toBe('?corps=00126380,00164779')
    expect(await screen.findByRole('table')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '삼성전자 빼기' }))
    expect(location()).toBe('?corps=00164779')
    expect(screen.getByText(/비교할 기업을 2곳 이상 골라 주세요/)).toBeTruthy()
  })

  it('4곳이 차 있으면 5번째는 더하지 않고 안내한다', async () => {
    renderAt('?corps=00126380,00164779,00000003,00000004')
    await search('기업들')
    fireEvent.click(await screen.findByRole('button', { name: '다섯째기업 더하기' }))
    expect(screen.getByText('최대 4곳까지 비교할 수 있어요.')).toBeTruthy()
    expect(location()).toBe('?corps=00126380,00164779,00000003,00000004')
    expect(api.getFinancialTrends).not.toHaveBeenCalledWith('00000005', expect.anything(), expect.anything())
  })

  it('같은 주소를 다시 열면 같은 비교(기업·순서·종류·기준)를 보여 준다', async () => {
    const first = renderAt('?corps=00164779,00126380&type=ANNUAL&fs=OFS')
    await screen.findAllByText('300조원')
    const saved = location()
    first.unmount()

    renderAt(saved)
    await screen.findAllByText('300조원')
    expect(screen.getByRole('button', { name: '별도' }).getAttribute('aria-pressed')).toBe('true')
    const names = screen.getAllByRole('columnheader').map((h) => h.querySelector('.company-compare__name')?.textContent)
    expect(names.slice(1, 3)).toEqual(['SK하이닉스', '삼성전자'])
    expect(api.getFinancialTrends).toHaveBeenCalledWith('00164779', 'OFS', expect.any(AbortSignal))
  })

  it('검색 결과는 입력칸 아래에 떠서 보이고, 더하면 입력을 비우고 닫는다(#424)', async () => {
    renderAt('')
    await search('삼성')
    const add = await screen.findByRole('button', { name: '삼성전자 더하기' })
    const popover = add.closest('.company-picker__popover') as HTMLElement
    expect(popover).not.toBeNull()
    expect(popover.hidden).toBe(false)
    fireEvent.click(add)
    expect((screen.getByRole('searchbox') as HTMLInputElement).value).toBe('')
    expect(popover.hidden).toBe(true)
  })

  it('검색 결과는 Esc를 누르면 닫는다', async () => {
    renderAt('')
    await search('삼성')
    const add = await screen.findByRole('button', { name: '삼성전자 더하기' })
    fireEvent.keyDown(screen.getByRole('searchbox'), { key: 'Escape' })
    expect((add.closest('.company-picker__popover') as HTMLElement).hidden).toBe(true)
  })

  it('검색 뒤 ↓로 결과의 더하기에 가고 ↑↓로 옮겨 Enter로 더하면 입력칸으로 돌아온다(#426)', async () => {
    renderAt('')
    await search('삼성')
    const first = await screen.findByRole('button', { name: '삼성전자 더하기' })
    const input = screen.getByRole('searchbox')
    input.focus()

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(first)
    const buttons = Array.from(first.closest('.company-picker__popover')!.querySelectorAll<HTMLElement>('[data-pick-button]'))
    if (buttons.length > 1) {
      fireEvent.keyDown(first, { key: 'ArrowDown' })
      expect(document.activeElement).toBe(buttons[1])
      fireEvent.keyDown(buttons[1], { key: 'End' })
      expect(document.activeElement).toBe(buttons.at(-1))
      fireEvent.keyDown(document.activeElement!, { key: 'Home' })
      expect(document.activeElement).toBe(first)
    }
    fireEvent.keyDown(first, { key: 'ArrowUp' })
    expect(document.activeElement).toBe(input)

    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.click(document.activeElement!)
    expect(location()).toBe('?corps=00126380')
    expect(document.activeElement).toBe(input)
    expect((input as HTMLInputElement).value).toBe('')
  })

  it('검색 결과에서 Esc를 누르면 닫고 입력칸으로 돌아온다', async () => {
    renderAt('')
    await search('삼성')
    const first = await screen.findByRole('button', { name: '삼성전자 더하기' })
    first.focus()
    fireEvent.keyDown(first, { key: 'Escape' })
    expect(document.activeElement).toBe(screen.getByRole('searchbox'))
    expect((first.closest('.company-picker__popover') as HTMLElement).hidden).toBe(true)
  })

  it('로그인했으면 관심 기업을 바로 고를 수 있다', async () => {
    favoritesApi.getFavoriteCompanies.mockResolvedValue({
      items: [{ ...companies['00164779'], addedAt: '2026-10-01T10:00:00' }],
    })
    const member: AuthContextValue = { state: { status: 'authenticated', userId: 7 }, login: vi.fn(), logout: vi.fn() }
    renderAt('?corps=00126380', member)
    const chip = await screen.findByRole('button', { name: 'SK하이닉스' })
    expect(chip.getAttribute('aria-pressed')).toBe('false')
    fireEvent.click(chip)
    expect(location()).toBe('?corps=00126380,00164779')
    expect(screen.getByRole('button', { name: 'SK하이닉스' }).getAttribute('aria-pressed')).toBe('true')
  })
})
