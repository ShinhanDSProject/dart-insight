// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FinancialTrend, FsDiv, TrendPeriod } from '@/shared/api/financialTrends'
import { ApiError } from '@/shared/api/client'
import { axeViolations } from '@/test/axe'
import { FinancialTrendSection } from './FinancialTrendSection'

const getFinancialTrends = vi.fn<(corpCode: string, fsDiv: FsDiv, signal?: AbortSignal) => Promise<FinancialTrend>>()

vi.mock('@/shared/api/financialTrends', () => ({
  getFinancialTrends: (corpCode: string, fsDiv: FsDiv, signal?: AbortSignal) =>
    getFinancialTrends(corpCode, fsDiv, signal),
}))

function period(rceptNo: string, reportType: TrendPeriod['reportType'], fiscalYear: number, periodEnd: string,
  dataStatus: TrendPeriod['dataStatus'] = 'AVAILABLE', sourceRceptNo: string | null = rceptNo): TrendPeriod {
  return {
    rceptNo,
    reportType,
    reportName: `보고서 (${periodEnd})`,
    fiscalYear,
    periodEnd,
    dataStatus,
    sourceRceptNo: dataStatus === 'AVAILABLE' ? sourceRceptNo : null,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

function trend(overrides: Partial<FinancialTrend> = {}): FinancialTrend {
  const periods = [
    period('20260814003699', 'HALF', 2026, '2026-06-30'),
    period('20260515002181', 'Q1', 2026, '2026-03-31', 'FETCH_FAILED'),
    period('20250814003156', 'HALF', 2025, '2025-06-30', 'AVAILABLE', '20260101000001'),
  ]
  const v = (index: number, amount: number | null, quarterAmount: number | null = null) => ({
    rceptNo: periods[index].rceptNo,
    amount,
    quarterAmount,
    currency: amount === null ? null : 'KRW',
  })
  return {
    corpCode: '00126380',
    fsDiv: 'CFS',
    refreshError: null,
    periods,
    accounts: [
      { key: 'TOTAL_ASSETS', name: '자산총계', sjDiv: 'BS', amountBasis: 'POINT', values: [v(0, 759_480_516_000_000), v(1, null), v(2, null)] },
      {
        key: 'REVENUE',
        name: '매출액',
        sjDiv: 'IS',
        amountBasis: 'CUMULATIVE',
        values: [v(0, 305_372_914_000_000, 171_499_470_000_000), v(1, null), v(2, 153_706_820_000_000, 74_566_317_000_000)],
      },
      { key: 'OPERATING_INCOME', name: '영업이익', sjDiv: 'IS', amountBasis: 'CUMULATIVE', values: [v(0, 0, 0), v(1, null), v(2, null)] },
    ],
    ...overrides,
  }
}

beforeEach(() => {
  getFinancialTrends.mockReset()
})
afterEach(cleanup)

describe('주요 재무 흐름', () => {
  it('기본은 가장 최근 보고서와 같은 종류(반기)끼리 비교하고 기준을 밝힌다', async () => {
    getFinancialTrends.mockResolvedValue(trend())
    const { container } = render(<FinancialTrendSection corpCode="00126380" />)

    const revenue = await screen.findByRole('img', { name: '매출액: 2025 반기 153.7조원, 2026 반기 305.4조원' })
    expect(revenue).toBeTruthy()
    expect(screen.getByRole('img', { name: '자산총계: 2025 반기 값 없음, 2026 반기 759.5조원' })).toBeTruthy()
    expect(screen.getByRole('img', { name: '영업이익: 2025 반기 값 없음, 2026 반기 0원' })).toBeTruthy()
    expect(screen.getByText(/연결 기준 · 재무상태표는 기말\(06\.30\) 잔액, 손익은 사업연도 시작부터 누적/)).toBeTruthy()
    expect(getFinancialTrends).toHaveBeenCalledWith('00126380', 'CFS', expect.any(AbortSignal))
    expect(await axeViolations(container)).toBe('')
  })

  it('3개월 기준으로 바꾸면 손익은 3개월 금액을 보인다', async () => {
    getFinancialTrends.mockResolvedValue(trend())
    render(<FinancialTrendSection corpCode="00126380" />)
    await screen.findByRole('group', { name: '손익 금액 기준' })

    fireEvent.click(screen.getByRole('button', { name: '3개월' }))

    expect(screen.getByRole('img', { name: '매출액: 2025 반기 74.6조원, 2026 반기 171.5조원' })).toBeTruthy()
    expect(screen.getByText(/손익은 그 분기 3개월/)).toBeTruthy()
  })

  it('표 보기는 없는 값을 0이 아니라 —로 보이고 열 머리글이 근거 공시를 연다', async () => {
    getFinancialTrends.mockResolvedValue(trend())
    const { container } = render(<FinancialTrendSection corpCode="00126380" />)
    await screen.findByRole('group', { name: '보기' })

    fireEvent.click(screen.getByRole('button', { name: '표' }))

    const table = screen.getByRole('table')
    const assets = within(table).getByRole('row', { name: /자산총계/ })
    const cells = within(assets).getAllByRole('cell')
    expect(cells[0].textContent).toBe('—값 없음')
    expect(cells[1].textContent).toBe('759,480,516')
    const operating = within(table).getByRole('row', { name: /영업이익/ })
    expect(within(operating).getAllByRole('cell')[1].textContent).toBe('0')
    // 정정 공시 값이면 그 접수번호로 연다
    const corrected = within(table).getByRole('link', { name: /2025 반기/ })
    expect(corrected.getAttribute('href')).toBe('https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260101000001')
    expect(within(table).getByText('정정 공시 값')).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('받지 못한 보고서가 있으면 알리고 다시 시도할 수 있다', async () => {
    getFinancialTrends.mockResolvedValue(trend())
    render(<FinancialTrendSection corpCode="00126380" />)

    expect(await screen.findByText('보고서 1개의 주요계정을 받지 못했어요.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }))
    await screen.findByText('보고서 1개의 주요계정을 받지 못했어요.')
    expect(getFinancialTrends).toHaveBeenCalledTimes(2)
  })

  it('별도 기준으로 바꾸면 OFS로 다시 부른다', async () => {
    getFinancialTrends.mockResolvedValue(trend())
    render(<FinancialTrendSection corpCode="00126380" />)
    await screen.findByRole('group', { name: '비교할 보고서 종류' })

    fireEvent.click(screen.getByRole('button', { name: '별도' }))

    await screen.findByRole('group', { name: '비교할 보고서 종류' })
    expect(getFinancialTrends).toHaveBeenLastCalledWith('00126380', 'OFS', expect.any(AbortSignal))
  })

  it('보고서 종류를 바꾸면 그 종류끼리 보인다', async () => {
    getFinancialTrends.mockResolvedValue(trend())
    render(<FinancialTrendSection corpCode="00126380" />)
    await screen.findByRole('group', { name: '비교할 보고서 종류' })

    fireEvent.click(screen.getByRole('button', { name: '1분기보고서' }))

    expect(screen.getByText('1분기보고서의 주요계정 값이 없어요.')).toBeTruthy()
  })

  it('불러오지 못하면 오류와 다시 시도를 보인다', async () => {
    getFinancialTrends.mockRejectedValue(new ApiError(502, { code: 'DART_REQUEST_FAILED', message: 'x', traceId: 't1', errors: [] }))
    const { container } = render(<FinancialTrendSection corpCode="00126380" />)

    expect(await screen.findByText('OpenDART에서 보고서 목록을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.')).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('보고서가 없으면 빈 상태를 보인다', async () => {
    getFinancialTrends.mockResolvedValue(trend({ periods: [], accounts: [] }))
    render(<FinancialTrendSection corpCode="00126380" />)

    expect(await screen.findByText('정기보고서가 없어 재무 흐름을 보여 드릴 수 없어요.')).toBeTruthy()
  })
})
