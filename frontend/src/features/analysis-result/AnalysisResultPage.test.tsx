// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Analysis, AnalysisCreated } from '@/shared/api/analyses'
import type { ComparabilityRequest } from '@/shared/api/comparability'
import { ApiError } from '@/shared/api/client'
import type { ReportItem } from '@/shared/api/reports'
import { axeViolations } from '@/test/axe'
import { ResultOverviewContext, ResultReportsContext } from './overviewSlot'
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
  return (
    <>
      <p data-testid="where">{location.pathname}</p>
      <p data-testid="where-search">{location.search}</p>
    </>
  )
}

function renderPage(path = '/analyses/14') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/analyses/:analysisId"
          element={
            <ResultOverviewContext.Provider value={(corpCode) => <p>기업 개요 {corpCode}</p>}>
              <ResultReportsContext.Provider value={(corpCode) => <p>보고서 선택 {corpCode}</p>}>
                <AnalysisResultPage />
              </ResultReportsContext.Provider>
            </ResultOverviewContext.Provider>
          }
        />
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
  it('이전 방식으로 만든 결과면 비교 맥락 아래에 안내를 보인다', async () => {
    getAnalysis.mockResolvedValue(analysis(true))
    renderPage()
    const button = await reanalyze()
    expect(screen.getByText(/이 결과는 이전 분석 방식으로 만들었어요/)).toBeTruthy()
    const context = screen.getByRole('region', { name: '비교 맥락' })
    expect(button.compareDocumentPosition(context) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy()
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
  it('기업명 제목 아래에 보고서 쌍·비교 기준·수치 기준을 두고, 보고서 바꾸기 대신 보고서 선택 탭을 이 분석의 보고서로 연다(#659)', async () => {
    getAnalysis.mockResolvedValue(analysis(false))
    renderPage()
    expect(await screen.findByRole('heading', { level: 1, name: '삼성전자' })).toBeTruthy()
    const lead = document.querySelector('.result-head__lead')
    expect(lead?.textContent).toContain('반기보고서 (2025.06) → 현재 보고서 반기보고서 (2026.06)')
    expect(lead?.textContent).toContain('전년 동기')
    expect(lead?.textContent).toContain('연결재무제표')
    expect(screen.queryByRole('button', { name: '보고서 바꾸기' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '보고서 선택' }))
    expect(await screen.findByText('보고서 선택 00126380')).toBeTruthy()
    expect(screen.getByTestId('where').textContent).toBe('/analyses/14')
    expect(new URLSearchParams(screen.getByTestId('where-search').textContent ?? '').toString()).toBe(
      'tab=reports&current=20260814001234&basis=YOY',
    )
  })

  it('보고서 선택 탭에 이미 고른 보고서가 주소에 있으면 그대로 두고, 직접 선택한 분석이면 이전 보고서도 넣는다(#659)', async () => {
    getAnalysis.mockResolvedValue(analysis(false))
    renderPage('/analyses/14?tab=reports&current=20250814000987')
    expect(await screen.findByText('보고서 선택 00126380')).toBeTruthy()
    expect(screen.getByTestId('where-search').textContent).toBe('?tab=reports&current=20250814000987')
    cleanup()
    getAnalysis.mockResolvedValue({ ...analysis(false), basis: 'CUSTOM' })
    renderPage('/analyses/14?tab=reports')
    expect(await screen.findByText('보고서 선택 00126380')).toBeTruthy()
    expect(new URLSearchParams(screen.getByTestId('where-search').textContent ?? '').get('previous')).toBe('20250814000987')
  })

  it('탭은 기업 개요(#589)·요약·재무 수치·문장 변화·커뮤니티·뉴스(#592)·원문·보고서 선택(#659) 여덟 개다', async () => {
    getAnalysis.mockResolvedValue(analysis(false))
    renderPage()
    const tabs = await screen.findByRole('navigation', { name: '결과 보기' })
    expect(Array.from(tabs.querySelectorAll('a, button')).map((el) => el.textContent)).toEqual([
      '기업 개요',
      '요약',
      '재무 수치',
      '문장 변화',
      '커뮤니티',
      '뉴스',
      '원문',
      '보고서 선택',
    ])
  })

  it('예전 AI 질문 탭 주소(?tab=ask)로 들어오면 요약 탭을 보이고 채팅 패널을 연다', async () => {
    getAnalysis.mockResolvedValue(analysis(false))
    renderPage('/analyses/14?tab=ask')
    expect(await screen.findByRole('dialog', { name: 'AI 에이전트' })).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('where-search').textContent).toBe('?tab=summary'))
    expect(screen.getByRole('dialog', { name: 'AI 에이전트' })).toBeTruthy()
  })

  it('AI 에이전트 버튼으로 채팅 패널을 열고, 탭을 바꿔도 패널이 닫히지 않는다(AC20)', async () => {
    getAnalysis.mockResolvedValue(analysis(false))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: 'AI 에이전트' }))
    const panel = screen.getByRole('dialog', { name: 'AI 에이전트' })
    expect(within(panel).getByText(/개인정보는 쓰지 마세요/)).toBeTruthy()
    const tabs = screen.getByRole('navigation', { name: '결과 보기' })
    fireEvent.click(within(tabs).getByText('문장 변화'))
    expect(screen.getByTestId('where-search').textContent).toContain('tab=text')
    expect(screen.getByRole('dialog', { name: 'AI 에이전트' })).toBeTruthy()
    fireEvent.click(within(panel).getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('dialog', { name: 'AI 에이전트' })).toBeNull()
  })

  it('기업 개요 탭은 화면을 옮기지 않고 탭 줄 아래에 그 기업의 개요를 그린다(#589)', async () => {
    getAnalysis.mockResolvedValue(analysis(false))
    renderPage()
    fireEvent.click(await screen.findByRole('button', { name: '기업 개요' }))
    expect(screen.getByText('기업 개요 00126380')).toBeTruthy()
    expect(screen.getByTestId('where').textContent).toBe('/analyses/14')
    expect(screen.getByTestId('where-search').textContent).toBe('?tab=overview')
    expect(screen.getByRole('navigation', { name: '결과 보기' })).toBeTruthy()
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
