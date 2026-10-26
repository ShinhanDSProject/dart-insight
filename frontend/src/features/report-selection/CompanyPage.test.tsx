// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Company, CompanyOverview } from '@/shared/api/companies'
import type { ReportList } from '@/shared/api/reports'
import { AuthContext, type AuthContextValue } from '@/shared/auth/authContext'
import { axeViolations } from '@/test/axe'
import { samsungOverview } from '@/test/fixtures/companyOverview'
import { CompanyPage } from './CompanyPage'

const getCompany = vi.fn<(corpCode: string) => Promise<Company>>()
const getCompanyOverview = vi.fn<(corpCode: string) => Promise<CompanyOverview>>()
const listReports = vi.fn<(corpCode: string) => Promise<ReportList>>()

vi.mock('@/shared/api/companies', () => ({
  getCompany: (corpCode: string) => getCompany(corpCode),
  getCompanyOverview: (corpCode: string) => getCompanyOverview(corpCode),
}))

vi.mock('@/shared/api/reports', () => ({
  listReports: (corpCode: string) => listReports(corpCode),
  getReport: vi.fn(),
  getReportPair: vi.fn(),
}))

vi.mock('@/shared/api/analyses', () => ({
  listCompanyAnalyses: () => Promise.resolve({ items: [] }),
}))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}

// 별 버튼(관심 기업)은 로그인 상태를 읽는다(#36). 이 테스트는 탭만 보므로 로그인하지 않은 상태로 그린다
const anonymous: AuthContextValue = { state: { status: 'anonymous' }, login: vi.fn(), logout: vi.fn() }

function renderPage(search = '') {
  return render(
    <AuthContext.Provider value={anonymous}>
      <MemoryRouter initialEntries={[`/companies/00126380${search}`]}>
        <Routes>
          <Route
            path="/companies/:corpCode"
            element={
              <>
                <CompanyPage />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

beforeEach(() => {
  getCompany.mockReset().mockResolvedValue({ corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true })
  getCompanyOverview.mockReset().mockResolvedValue(samsungOverview)
  listReports.mockReset().mockResolvedValue({ corpCode: '00126380', fetchedAt: null, refreshError: null, items: [] })
})
afterEach(cleanup)

describe('기업 화면 탭', () => {
  it('?view가 없으면 기존처럼 보고서 비교 탭이 열리고 개황은 부르지 않는다', async () => {
    renderPage('?basis=PREV')

    expect(await screen.findByText('이 기업의 정기보고서가 없어요.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '보고서 비교' }).getAttribute('aria-current')).toBe('page')
    expect(getCompanyOverview).not.toHaveBeenCalled()
    expect(document.title).toBe('삼성전자 보고서 고르기 · DART Insight')
  })

  it('?view=overview면 기업 개요 탭에 개황 카드를 보여 주고 보고서 목록은 부르지 않는다', async () => {
    const { container } = renderPage('?view=overview')

    expect(await screen.findByRole('region', { name: '기업 개황' })).toBeTruthy()
    expect(await screen.findByText('전영현, 노태문')).toBeTruthy()
    expect(screen.getByRole('button', { name: '기업 개요' }).getAttribute('aria-current')).toBe('page')
    expect(listReports).not.toHaveBeenCalled()
    expect(document.title).toBe('삼성전자 기업 개요 · DART Insight')
    expect(await axeViolations(container)).toBe('')
  })

  it('탭을 누르면 주소의 ?view만 바꾸고 보고서 비교에서 고른 값은 남긴다', async () => {
    renderPage('?basis=PREV')
    await screen.findByText('이 기업의 정기보고서가 없어요.')

    fireEvent.click(screen.getByRole('button', { name: '기업 개요' }))
    expect(await screen.findByRole('region', { name: '기업 개황' })).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('?basis=PREV&view=overview')

    fireEvent.click(screen.getByRole('button', { name: '보고서 비교' }))
    expect(await screen.findByText('이 기업의 정기보고서가 없어요.')).toBeTruthy()
    expect(screen.getByTestId('location').textContent).toBe('?basis=PREV')
  })

  it('보고서 목록이 OpenDART 오류여도 기업 개요 탭은 열린다', async () => {
    listReports.mockRejectedValue(new Error('network'))
    renderPage()
    expect(await screen.findByRole('alert')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '기업 개요' }))
    expect(await screen.findByText('전영현, 노태문')).toBeTruthy()
  })
})
