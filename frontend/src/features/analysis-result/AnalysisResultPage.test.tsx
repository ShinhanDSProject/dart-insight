// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Analysis, AnalysisCreated } from '@/shared/api/analyses'
import type { ComparabilityRequest } from '@/shared/api/comparability'
import { ApiError } from '@/shared/api/client'
import type { ReportItem } from '@/shared/api/reports'
import { axeViolations } from '@/test/axe'
import { AnalysisResultPage } from './AnalysisResultPage'

const getAnalysis = vi.fn<(analysisId: string | number) => Promise<Analysis>>()
const requestAnalysis = vi.fn<(request: ComparabilityRequest) => Promise<AnalysisCreated>>()

vi.mock('@/shared/api/analyses', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/api/analyses')>()),
  getAnalysis: (analysisId: string | number) => getAnalysis(analysisId),
  requestAnalysis: (request: ComparabilityRequest) => requestAnalysis(request),
}))

// 안내만 보려고 탭·카드와 그 안에서 불러오는 훅은 빈 조각으로 바꾼다
vi.mock('@/shared/hooks/useRecentAnalyses', () => ({ useRecordRecentAnalysis: () => {} }))
vi.mock('./hooks/useAsk', () => ({ useAsk: () => ({ state: { request: { status: 'idle' } } }) }))
vi.mock('./hooks/useAskSuggestions', () => ({
  useAskSuggestions: () => ({ questions: { status: 'loading' }, sections: [], sectionCounts: [] }),
}))
vi.mock('./components/OtherAnalyses', () => ({ OtherAnalyses: () => null }))
vi.mock('./components/ComparisonContextCard', () => ({
  ComparisonContextCard: () => <section aria-label="비교 맥락">비교 맥락</section>,
}))
vi.mock('./components/SummaryTab', () => ({ SummaryTab: () => <p>요약</p> }))

function analysis(outdated: boolean): Analysis {
  return {
    analysisId: 14,
    corpCode: '00126380',
    corpName: '삼성전자',
    basis: 'YOY',
    fsDiv: 'CFS',
    current: { rceptNo: '20260814001234', reportName: '반기보고서 (2026.06)' } as ReportItem,
    previous: { rceptNo: '20250814000987', reportName: '반기보고서 (2025.06)' } as ReportItem,
    status: 'COMPLETED',
    step: 'DONE',
    steps: [],
    error: null,
    createdAt: '2026-10-21T14:06:00',
    completedAt: '2026-10-21T14:07:00',
    textStatus: 'COMPLETED',
    textMessage: null,
    summaryStatus: 'COMPLETED',
    summaryMessage: null,
    analysisVersion: outdated ? 'm2-8' : 'm2-9',
    outdated,
  }
}

function Where() {
  const location = useLocation()
  return <p data-testid="where">{location.pathname}</p>
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/analyses/14']}>
      <Routes>
        <Route path="/analyses/:analysisId" element={<AnalysisResultPage />} />
        <Route path="*" element={null} />
      </Routes>
      <Where />
    </MemoryRouter>,
  )
}

const reanalyze = () => screen.findByRole('button', { name: '새 방식으로 다시 분석' })

beforeEach(() => {
  getAnalysis.mockReset()
  requestAnalysis.mockReset()
})
afterEach(cleanup)

describe('이전 방식 분석 안내', () => {
  it('이전 방식으로 만든 결과면 비교 맥락 위에 안내를 보인다', async () => {
    getAnalysis.mockResolvedValue(analysis(true))
    renderPage()
    const button = await reanalyze()
    expect(screen.getByText(/이 결과는 이전 분석 방식으로 만들었어요/)).toBeTruthy()
    const context = screen.getByRole('region', { name: '비교 맥락' })
    expect(button.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('지금 방식으로 만든 결과면 안내를 보이지 않고 상단 경로 회사명이 기업 개요로 연결된다', async () => {
    getAnalysis.mockResolvedValue(analysis(false))
    renderPage()
    await screen.findByRole('region', { name: '비교 맥락' })
    expect(screen.queryByText(/이전 분석 방식/)).toBeNull()
    expect(screen.queryByRole('button', { name: '새 방식으로 다시 분석' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '내보내기' }))
    expect(screen.getByRole('button', { name: '브리프 내려받기' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '인쇄' })).toBeTruthy()
    const companyLink = screen.getByRole('link', { name: '삼성전자' })
    expect(companyLink.getAttribute('href')).toBe('/companies/00126380?view=overview')
  })

  it('다시 분석하면 같은 기업·보고서·비교 기준으로 요청하고, 새로 만들면 진행 화면으로 간다', async () => {
    getAnalysis.mockResolvedValue(analysis(true))
    let resolve: (created: AnalysisCreated) => void = () => {}
    requestAnalysis.mockReturnValue(new Promise((r) => (resolve = r)))
    renderPage()
    const button = await reanalyze()
    fireEvent.click(button)

    expect(requestAnalysis).toHaveBeenCalledWith({
      corpCode: '00126380',
      currentRceptNo: '20260814001234',
      previousRceptNo: '20250814000987',
      basis: 'YOY',
    })
    const sending = await screen.findByRole('button', { name: '분석을 요청하는 중…' })
    expect((sending as HTMLButtonElement).disabled).toBe(true)

    resolve({ analysisId: 17, status: 'PENDING', step: 'RECEIVED', reused: false })
    expect((await screen.findByText('/analyses/17/progress')).dataset.testid).toBe('where')
  })

  it('이미 새 방식 결과가 있으면(reused) 그 결과로 바로 간다', async () => {
    getAnalysis.mockResolvedValue(analysis(true))
    requestAnalysis.mockResolvedValue({ analysisId: 16, status: 'COMPLETED', step: 'DONE', reused: true })
    renderPage()
    fireEvent.click(await reanalyze())
    expect(await screen.findByText('/analyses/16')).toBeTruthy()
  })

  it('요청에 실패하면 오류 안내를 보이고 다시 누를 수 있다', async () => {
    getAnalysis.mockResolvedValue(analysis(true))
    requestAnalysis.mockRejectedValue(
      new ApiError(422, { code: 'ANALYSIS_NOT_COMPARABLE', message: 'x', traceId: 'trace-1', errors: [] }),
    )
    renderPage()
    fireEvent.click(await reanalyze())
    expect(await screen.findByText('비교할 수 없는 보고서 쌍이라 분석을 시작하지 않았어요.')).toBeTruthy()
    expect(((await reanalyze()) as HTMLButtonElement).disabled).toBe(false)
    expect(screen.getByTestId('where').textContent).toBe('/analyses/14')
  })

  it('안내에 접근성 위반이 없다', async () => {
    getAnalysis.mockResolvedValue(analysis(true))
    const { container } = renderPage()
    await reanalyze()
    expect(await axeViolations(container)).toBe('')
  })
})

describe('결과 머리(#550)', () => {
  it('기업명 제목 아래에 보고서 쌍·비교 기준·수치 기준과 보고서 바꾸기 링크를 둔다', async () => {
    getAnalysis.mockResolvedValue(analysis(false))
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: '삼성전자' })).toBeTruthy()
    const lead = document.querySelector('.result-head__lead')
    expect(lead?.textContent).toContain('반기보고서 (2025.06) → 현재 보고서 반기보고서 (2026.06)')
    expect(lead?.textContent).toContain('전년 동기')
    expect(lead?.textContent).toContain('연결재무제표')
    expect(screen.getByRole('link', { name: '보고서 바꾸기' }).getAttribute('href')).toBe(
      '/companies/00126380?current=20260814001234&basis=YOY',
    )
  })

  it('탭은 요약·재무 수치·문장 변화·AI 질문·원문 다섯 개다', async () => {
    getAnalysis.mockResolvedValue(analysis(false))
    renderPage()
    const tabs = await screen.findByRole('navigation', { name: '결과 보기' })
    expect(Array.from(tabs.querySelectorAll('a, button')).map((el) => el.textContent)).toEqual([
      '요약',
      '재무 수치',
      '문장 변화',
      'AI 질문',
      '원문',
    ])
  })

  it('내보내기는 펼치기 전에는 항목을 숨기고 Esc로 닫는다', async () => {
    getAnalysis.mockResolvedValue(analysis(false))
    renderPage()
    const button = await screen.findByRole('button', { name: '내보내기' })
    expect(screen.queryByRole('button', { name: '인쇄' })).toBeNull()
    fireEvent.click(button)
    expect(button.getAttribute('aria-expanded')).toBe('true')
    fireEvent.keyDown(screen.getByRole('button', { name: '인쇄' }), { key: 'Escape' })
    expect(button.getAttribute('aria-expanded')).toBe('false')
  })
})
