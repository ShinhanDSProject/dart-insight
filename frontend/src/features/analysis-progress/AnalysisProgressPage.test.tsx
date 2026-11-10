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

const comparability = vi.hoisted(() => ({ check: vi.fn() }))

vi.mock('@/shared/api/comparability', () => ({
  checkComparability: comparability.check,
}))

afterEach(() => {
  cleanup()
  analysis = running
  comparability.check.mockReset()
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
    // 기다리는 동안 창을 닫아도 된다고 알리고, 공팡이는 제목 옆에 작게 둔다(#841)
    expect(within(steps).getByText(/창을 닫아도 분석은 계속돼요/)).toBeTruthy()
    expect(steps.querySelector('.progress__head .mascot--sm')).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('실패하면 분석 실패 배지, 오류 안내, 보고서 다시 선택과 분석 실행을 보인다', async () => {
    comparability.check.mockRejectedValue(new Error('network'))
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

  it('실패하면 비교 조건을 다시 확인해 조건 표를 실패 안내 위에 보이고, 진행 중에는 확인하지 않는다(FS-69)', async () => {
    comparability.check.mockResolvedValue({
      checks: [
        { item: 'COMPANY', label: '기업', status: 'OK', detail: '두 보고서 모두 삼성전자의 보고서예요.' },
        { item: 'REPORT_PERIOD', label: '보고서 종류·기간', status: 'OK', detail: '2025 반기 → 2026 반기(전년 동기)' },
      ],
      reasons: [],
    })
    const { unmount } = renderPage()
    await screen.findByRole('region', { name: '원문에서 근거까지, 순서대로 확인해요' })
    expect(comparability.check).not.toHaveBeenCalled()
    unmount()

    analysis = {
      ...running,
      status: 'FAILED',
      steps: running.steps.map((s) => (s.step === 'COMPARING' ? { ...s, state: 'FAILED' } : s)),
      error: { code: 'ANALYSIS_FAILED', message: '분석 중 오류가 났어요.', retryable: true },
    }
    const { container } = renderPage()
    const table = await screen.findByRole('region', { name: '비교 조건' })
    expect(comparability.check).toHaveBeenCalledWith(
      { corpCode: '00126380', currentRceptNo: '20260814000001', previousRceptNo: '20250814000001', basis: 'YOY' },
      expect.anything(),
    )
    expect(within(table).getAllByRole('row').map((row) => row.textContent)).toEqual([
      '기업두 보고서 모두 삼성전자의 보고서예요.확인됨',
      '보고서 종류·기간2025 반기 → 2026 반기(전년 동기)확인됨',
    ])
    expect(table.compareDocumentPosition(screen.getByRole('alert')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })
})
