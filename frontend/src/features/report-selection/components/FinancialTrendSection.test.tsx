// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FinancialTrend, FsDiv, TrendAccount, TrendPeriod } from '@/shared/api/financialTrends'
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

/** 비율 보기용 응답: 2026 반기(정상), 1분기(받지 못함), 2025 반기(정정 공시 값, 매출액 없음·자본 음수·유동부채 0) */
function ratioTrend(): FinancialTrend {
  const base = trend()
  const periods = base.periods
  const v = (index: number, amount: number | null, quarterAmount: number | null = null) => ({
    rceptNo: periods[index].rceptNo,
    amount,
    quarterAmount,
    currency: amount === null ? null : 'KRW',
  })
  const bs = (key: TrendAccount['key'], name: string, a: number | null, b: number | null): TrendAccount => ({
    key, name, sjDiv: 'BS', amountBasis: 'POINT', values: [v(0, a), v(1, null), v(2, b)],
  })
  const is = (key: TrendAccount['key'], name: string, a: [number, number], b: number | null): TrendAccount => ({
    key, name, sjDiv: 'IS', amountBasis: 'CUMULATIVE', values: [v(0, a[0], a[1]), v(1, null), v(2, b, b)],
  })
  return {
    ...base,
    accounts: [
      bs('CURRENT_ASSETS', '유동자산', 200_000_000_000, 100_000_000_000),
      bs('CURRENT_LIABILITIES', '유동부채', 100_000_000_000, 0),
      bs('TOTAL_LIABILITIES', '부채총계', 300_000_000_000, 500_000_000_000),
      bs('TOTAL_EQUITY', '자본총계', 600_000_000_000, -100_000_000_000),
      is('REVENUE', '매출액', [1_000_000_000_000, 400_000_000_000], null),
      is('OPERATING_INCOME', '영업이익', [123_400_000_000, 60_000_000_000], -10_000_000_000),
      is('NET_INCOME', '당기순이익', [0, 0], 5_000_000_000),
    ],
  }
}

describe('재무 비율 보기', () => {
  async function openRatios() {
    getFinancialTrends.mockResolvedValue(ratioTrend())
    const view = render(<FinancialTrendSection corpCode="00126380" />)
    await screen.findByRole('group', { name: '보여 줄 값' })
    fireEvent.click(screen.getByRole('button', { name: '비율' }))
    return view
  }

  it('비율로 바꾸면 네 비율을 받은 기간만 오래된 순서로 보이고 차트·표 고르기는 숨긴다', async () => {
    const { container } = await openRatios()

    const table = screen.getByRole('table')
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent)
    expect(headers).toEqual(['비율 · 단위 %', '2025 반기', '2026 반기'])
    const rows = within(table).getAllByRole('rowheader').map((h) => h.textContent)
    expect(rows).toEqual([
      '부채비율 부채총계 ÷ 자본총계 × 100',
      '유동비율 유동자산 ÷ 유동부채 × 100',
      '영업이익률 영업이익 ÷ 매출액 × 100',
      '순이익률 당기순이익 ÷ 매출액 × 100',
    ])
    expect(screen.getByRole('button', { name: '2026 반기 부채비율 50.0%' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '2026 반기 영업이익률 12.3%' })).toBeTruthy()
    // 0은 값이 있는 0%다
    expect(screen.getByRole('button', { name: '2026 반기 순이익률 0.0%' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: '보기' })).toBeNull()
    expect(screen.getByText('비율은 주요계정 값으로 코드가 계산했어요. 업종이나 기준값과 비교하지 않아요.')).toBeTruthy()
    // 받지 못한 보고서가 있으면 받은 기간만 보인다고 알리고 다시 시도할 수 있다
    expect(screen.getByText(/비율은 받은 기간만 계산해 보여 드려요/)).toBeTruthy()
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
    expect(await axeViolations(container)).toBe('')
  })

  it('계산하지 못한 칸은 0이 아니라 이유를 보인다', async () => {
    await openRatios()

    expect(screen.getByRole('button', { name: '2025 반기 부채비율 계산 불가 · 자본총계가 음수' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '2025 반기 유동비율 계산 불가 · 유동부채가 0' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '2025 반기 영업이익률 계산 불가 · 매출액 미기재' })).toBeTruthy()
    expect(screen.getByRole('button', { name: '2025 반기 순이익률 계산 불가 · 매출액 미기재' })).toBeTruthy()
  })

  it('값을 누르면 계산식·두 금액·손익 기준·근거 보고서 링크를 보인다', async () => {
    const { container } = await openRatios()

    const cell = screen.getByRole('button', { name: '2026 반기 영업이익률 12.3%' })
    fireEvent.click(cell)

    expect(cell.getAttribute('aria-expanded')).toBe('true')
    const detail = screen.getByRole('region', { name: '2026 반기 영업이익률 계산 근거' })
    expect(within(detail).getByText('영업이익 ÷ 매출액 × 100')).toBeTruthy()
    expect(within(detail).getByText('123,400백만원')).toBeTruthy()
    expect(within(detail).getByText('1,000,000백만원')).toBeTruthy()
    expect(within(detail).getByText('누적(01.01 ~ 06.30) · 연환산하지 않았어요')).toBeTruthy()
    const link = within(detail).getByRole('link', { name: /DART 원문 새 창으로 열기/ })
    expect(link.getAttribute('href')).toBe('https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260814003699')
    expect(await axeViolations(container)).toBe('')

    fireEvent.click(within(detail).getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('region', { name: /계산 근거/ })).toBeNull()
  })

  it('3개월 기준이면 손익 비율을 3개월 금액으로 다시 계산한다', async () => {
    await openRatios()

    fireEvent.click(screen.getByRole('button', { name: '3개월' }))
    fireEvent.click(screen.getByRole('button', { name: '2026 반기 영업이익률 15.0%' }))

    expect(screen.getByText('그 분기 3개월 · 연환산하지 않았어요')).toBeTruthy()
  })

  it('정정 공시 값이면 그 공시의 원문을 연다', async () => {
    await openRatios()

    fireEvent.click(screen.getByRole('button', { name: '2025 반기 부채비율 계산 불가 · 자본총계가 음수' }))

    const detail = screen.getByRole('region', { name: '2025 반기 부채비율 계산 근거' })
    expect(within(detail).getByText('−100,000백만원')).toBeTruthy()
    const link = within(detail).getByRole('link', { name: /DART 원문 새 창으로 열기/ })
    expect(link.getAttribute('href')).toBe('https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260101000001')
    expect(within(detail).getByText(/정정 공시 값/)).toBeTruthy()
  })
})
