// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Analysis } from '@/shared/api/analyses'
import type { ReportItem } from '@/shared/api/reports'
import { axeViolations } from '@/test/axe'
import { AnalysisProgressPage } from './AnalysisProgressPage'

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

const running: Analysis = {
  analysisId: 7,
  corpCode: '00126380',
  corpName: '삼성전자',
  basis: 'YOY',
  fsDiv: 'CFS',
  previous: report('20250814000001', 2025),
  current: report('20260814000001', 2026),
  status: 'RUNNING',
  step: 'COMPARING',
  steps: [
    { step: 'RECEIVED', label: '요청 접수', state: 'DONE' },
    { step: 'COMPARING', label: '보고서 비교', state: 'ACTIVE' },
    { step: 'VERIFYING', label: '근거 확인', state: 'PENDING' },
    { step: 'DONE', label: '완료', state: 'PENDING' },
  ],
  error: null,
  createdAt: '2026-10-30T10:00:00',
  completedAt: null,
  textStatus: null,
  textMessage: null,
  summaryStatus: null,
  summaryMessage: null,
  analysisVersion: 'm2-9',
  outdated: false,
}

let analysis: Analysis = running

vi.mock('@/shared/api/analyses', () => ({
  getAnalysis: () => Promise.resolve(analysis),
  analysisPath: (id: number) => `/analyses/${id}/progress`,
  requestAnalysis: vi.fn(),
}))

afterEach(() => {
  cleanup()
  analysis = running
})

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/analyses/7/progress']}>
      <Routes>
        <Route path="/analyses/:analysisId/progress" element={<AnalysisProgressPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('분석 진행 화면(#549)', () => {
  it('진행 중이면 분석 중 배지, 보고서 카드 두 장, 단계 카드와 진행 막대를 보인다', async () => {
    const { container } = renderPage()
    const steps = await screen.findByRole('region', { name: '원문에서 근거까지, 순서대로 확인해요' })
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('보고서의 변화를 분석하고 있어요')
    expect(screen.getByText('분석 중')).toBeTruthy()
    expect(screen.getByRole('region', { name: '이전 보고서' })).toBeTruthy()
    expect(screen.getByRole('region', { name: '현재 보고서' })).toBeTruthy()

    const items = within(steps).getAllByRole('listitem')
    expect(items.map((item) => item.textContent)).toEqual([
      '✓요청 접수완료',
      '보고서 비교진행 중',
      '근거 확인대기',
      '완료대기',
    ])
    expect(items[1].className).toContain('steps__item--active')
    const bar = within(steps).getByRole('progressbar', { name: '분석 진행률' })
    expect(bar.getAttribute('aria-valuenow')).toBe('38')
    expect(await axeViolations(container)).toBe('')
  })

  it('실패하면 분석 실패 배지, 오류 안내, 보고서 다시 선택과 분석 실행을 보인다', async () => {
    analysis = {
      ...running,
      status: 'FAILED',
      steps: running.steps.map((s) => (s.step === 'COMPARING' ? { ...s, state: 'FAILED' } : s)),
      error: { code: 'ANALYSIS_FAILED', message: '분석 중 오류가 났어요.', retryable: true },
    }
    const { container } = renderPage()
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('분석에 실패했어요')
    expect(alert.textContent).toContain('ANALYSIS_FAILED')
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('분석을 완료하지 못했어요')
    expect(screen.getByText('분석 실패').className).toContain('badge--danger')
    expect(screen.getByRole('link', { name: '보고서 다시 선택' }).getAttribute('href')).toBe(
      '/companies/00126380?current=20260814000001&previous=20250814000001&basis=YOY',
    )
    expect(screen.getByRole('button', { name: '↻ 분석 실행' })).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })
})
