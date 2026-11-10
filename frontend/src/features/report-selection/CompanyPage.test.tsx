// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Company, CompanyOverview } from '@/shared/api/companies'
import type { ReportItem, ReportList } from '@/shared/api/reports'
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
  // 보고서 자세히(ReportDetail)는 펼칠 때까지 기다리는 상태로 둔다
  getReport: () => new Promise(() => {}),
  getReportPair: () => new Promise(() => {}),
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

describe('보고서 고르기 맨 위 두 보고서(#840)', () => {
  const report = (rceptNo: string, reportName: string, fiscalYear: number, periodEnd: string): ReportItem => ({
    rceptNo,
    reportName,
    reportType: 'HALF',
    disclosureType: 'A002',
    fiscalYear,
    periodEnd,
    receivedAt: periodEnd,
    correction: 'ORIGINAL',
    financialDataStatus: 'UNKNOWN',
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  })
  const items = [report('20260814000001', '반기보고서 (2026.06)', 2026, '2026-06-30'), report('20250814000002', '반기보고서 (2025.06)', 2025, '2025-06-30')]

  it('고른 두 보고서와 이대로 비교하기를 맨 위에 두고, 정기보고서 목록은 접어 둔다', async () => {
    listReports.mockResolvedValue({ corpCode: '00126380', fetchedAt: null, refreshError: null, items })
    const { container } = renderPage('?basis=CUSTOM&previous=20250814000002')

    const summary = within(await screen.findByRole('region', { name: '이 두 보고서를 비교해요' }))
    expect(summary.getByText(/반기보고서 \(2025\.06\)/).textContent).toContain('반기보고서 (2026.06)')
    expect(summary.getByRole('link', { name: '이대로 비교하기 →' }).getAttribute('href')).toBe(
      '/companies/00126380/compare?current=20260814000001&previous=20250814000002&basis=CUSTOM',
    )
    expect(screen.getByText('정기보고서 목록').closest('details')?.open).toBe(false)
    expect(await axeViolations(container)).toBe('')
  })

  it('이전 보고서를 아직 고르지 않았으면 버튼 대신 고르라고 안내한다', async () => {
    listReports.mockResolvedValue({ corpCode: '00126380', fetchedAt: null, refreshError: null, items })
    renderPage('?basis=CUSTOM')

    const summary = within(await screen.findByRole('region', { name: '이 두 보고서를 비교해요' }))
    expect(summary.queryByRole('link', { name: '이대로 비교하기 →' })).toBeNull()
    expect(summary.getByText('아래에서 이전 보고서를 고르면 비교할 수 있어요.')).toBeTruthy()
  })
})
