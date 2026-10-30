// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ComparabilityResult } from '@/shared/api/comparability'
import type { ReportItem } from '@/shared/api/reports'
import { axeViolations } from '@/test/axe'
import { ComparabilityPage } from './ComparabilityPage'

function report(rceptNo: string, year: number): ReportItem {
  return {
    rceptNo,
    reportName: `반기보고서 (${year}.06)`,
    reportType: 'HALF',
    disclosureType: 'A002',
    fiscalYear: year,
    periodEnd: `${year}-06-30`,
    receivedAt: `${year}-08-14`,
    correction: 'ORIGINAL',
    financialDataStatus: 'AVAILABLE',
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

const base: ComparabilityResult = {
  comparable: true,
  level: 'FULL',
  fsDiv: 'CFS',
  previous: report('20250814000001', 2025),
  current: report('20260814000001', 2026),
  statements: [{ sjDiv: 'BS', label: '재무상태표', comparable: true, amountBasis: 'POINT', note: null }],
  checks: [
    { item: 'COMPANY', label: '기업', status: 'OK', detail: '삼성전자 · 같은 기업' },
    { item: 'PERIOD', label: '종류·기간', status: 'OK', detail: '반기보고서 / 반기보고서' },
  ],
  reasons: [],
}

let result: ComparabilityResult = base

vi.mock('@/shared/api/comparability', () => ({
  checkComparability: () => Promise.resolve(result),
}))
vi.mock('@/shared/api/companies', () => ({
  getCompany: () => Promise.resolve({ corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true }),
}))
vi.mock('@/shared/api/analyses', () => ({
  analysisPath: (id: number) => `/analyses/${id}/progress`,
  requestAnalysis: vi.fn(),
}))

afterEach(() => {
  cleanup()
  result = base
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/companies/00126380/compare?current=20260814000001&previous=20250814000001&basis=YOY']}>
      <Routes>
        <Route path="/companies/:corpCode/compare" element={<ComparabilityPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('비교 확인 화면(#549)', () => {
  it('비교할 수 있으면 분석 준비 배지, 이전·현재 보고서 카드, 조건 표의 확인 배지, 분석 실행 버튼을 보인다', async () => {
    const { container } = renderPage()
    const previousCard = await screen.findByRole('region', { name: '이전 보고서' })
    expect(within(previousCard).getByText('반기보고서 (2025.06)')).toBeTruthy()
    expect(within(previousCard).getByText('2025.01.01 ~ 06.30 · 제출 2025.08.14')).toBeTruthy()
    expect(screen.getByRole('region', { name: '현재 보고서' }).className).toContain('card--subtle')

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('비교 대상을 확인하세요')
    expect(screen.getByText('분석 준비')).toBeTruthy()
    const table = within(screen.getByRole('region', { name: '비교 조건' })).getByRole('table')
    expect(within(table).getAllByText('확인됨')).toHaveLength(2)
    expect(screen.getByRole('status').textContent).toContain('비교 조건을 확인했어요')
    expect((screen.getByRole('button', { name: '분석 실행' }) as HTMLButtonElement).disabled).toBe(false)
    expect(await screen.findByText(/삼성전자 · 005930 · 반기보고서 \(2025.06\) → 반기보고서 \(2026.06\)/)).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('비교할 수 없으면 비교 불가 배지, 문제 행의 분홍 배지, 오류 안내와 비활성 분석 실행을 보인다', async () => {
    result = {
      ...base,
      comparable: false,
      level: 'NOT_COMPARABLE',
      current: base.previous,
      checks: [
        base.checks[0],
        { item: 'PERIOD', label: '종류·기간', status: 'FAIL', detail: '반기보고서 / 반기보고서' },
      ],
      reasons: [{ code: 'SAME_REPORT', message: '같은 보고서를 두 번 골랐어요.', nextAction: '서로 다른 보고서를 골라 주세요.' }],
    }
    const { container } = renderPage()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('비교 불가')
    expect(alert.textContent).toContain('같은 보고서를 두 번 골랐어요.')

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('이 두 보고서는 비교할 수 없어요')
    const failBadge = within(screen.getByRole('table')).getByText('비교 불가')
    expect(failBadge.className).toContain('badge--danger')
    const run = screen.getByRole('button', { name: '분석 실행' }) as HTMLButtonElement
    expect(run.disabled).toBe(true)
    expect(screen.getByRole('link', { name: '보고서 다시 선택' }).getAttribute('href')).toBe(
      '/companies/00126380?current=20260814000001&previous=20250814000001&basis=YOY',
    )
    expect(await axeViolations(container)).toBe('')
  })
})
