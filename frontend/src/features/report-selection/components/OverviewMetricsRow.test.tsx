// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { FinancialTrend, FsDiv, TrendPeriod } from '@/shared/api/financialTrends'
import { axeViolations } from '@/test/axe'
import { OverviewMetricsRow } from './OverviewMetricsRow'

const getFinancialTrends = vi.fn<(corpCode: string, fsDiv: FsDiv) => Promise<FinancialTrend>>()

vi.mock('@/shared/api/financialTrends', () => ({
  getFinancialTrends: (corpCode: string, fsDiv: FsDiv) => getFinancialTrends(corpCode, fsDiv),
}))

function annual(rceptNo: string, fiscalYear: number): TrendPeriod {
  return {
    rceptNo,
    reportType: 'ANNUAL',
    reportName: `사업보고서 (${fiscalYear}.12)`,
    fiscalYear,
    periodEnd: `${fiscalYear}-12-31`,
    dataStatus: 'AVAILABLE',
    sourceRceptNo: rceptNo,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

const rceptNos = ['20260310002820', '20250311001085']

function trend(fsDiv: FsDiv, amounts: { revenue: (number | null)[]; operating: (number | null)[]; net: (number | null)[] }): FinancialTrend {
  const values = (list: (number | null)[]) =>
    list.map((amount, i) => ({ rceptNo: rceptNos[i], amount, quarterAmount: null, currency: amount === null ? null : 'KRW' }))
  return {
    corpCode: '00126380',
    fsDiv,
    refreshError: null,
    periods: [annual(rceptNos[0], 2025), annual(rceptNos[1], 2024)],
    accounts: [
      { key: 'REVENUE', name: '매출액', sjDiv: 'IS', amountBasis: 'CUMULATIVE', values: values(amounts.revenue) },
      { key: 'OPERATING_INCOME', name: '영업이익', sjDiv: 'IS', amountBasis: 'CUMULATIVE', values: values(amounts.operating) },
      { key: 'NET_INCOME', name: '당기순이익', sjDiv: 'IS', amountBasis: 'CUMULATIVE', values: values(amounts.net) },
    ],
  }
}

beforeEach(() => {
  // 동작 줄이기: count-up 없이 바로 최종 값
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: query.includes('reduce'), media: query }))
  getFinancialTrends.mockReset()
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('기업 개요 상단 지표 줄', () => {
  it('불러오는 동안 같은 자리에 카드 모양 세 개를 둔다', () => {
    getFinancialTrends.mockReturnValue(new Promise(() => {}))
    render(<OverviewMetricsRow corpCode="00126380" />)
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-busy')).toBe('true')
    expect(status.querySelectorAll('.skeleton__card')).toHaveLength(3)
  })

  it('최근 사업보고서 값과 전기 대비 증감, 근거 접수번호를 보이고 없는 값은 자료 없음이다', async () => {
    getFinancialTrends.mockResolvedValue(
      trend('CFS', {
        revenue: [300_000_000_000_000, 250_000_000_000_000],
        operating: [null, 10_000_000_000_000],
        net: [-4_000_000_000_000, 5_000_000_000_000],
      }),
    )
    const { container } = render(<OverviewMetricsRow corpCode="00126380" />)
    expect(await screen.findByText('매출액')).toBeTruthy()
    const items = container.querySelectorAll('.overview-metrics__item')
    expect(items[0].textContent).toContain('300조')
    expect(items[0].textContent).toContain('▲')
    expect(items[0].textContent).toContain('(+20.0%)')
    expect(items[0].textContent).toContain(rceptNos[0])
    expect(items[1].textContent).toContain('자료 없음')
    expect(items[2].textContent).toContain('적자전환')
    expect(getFinancialTrends).toHaveBeenCalledTimes(1)
    expect(await axeViolations(container)).toBe('')
  })

  it('연결 값이 하나도 없으면 별도 기준을 보고 그 기준을 적는다', async () => {
    getFinancialTrends.mockImplementation((_corp, fsDiv) =>
      Promise.resolve(
        fsDiv === 'CFS'
          ? trend('CFS', { revenue: [null, null], operating: [null, null], net: [null, null] })
          : trend('OFS', { revenue: [100, 90], operating: [10, 9], net: [5, 4] }),
      ),
    )
    render(<OverviewMetricsRow corpCode="00126380" />)
    expect(await screen.findByText(/별도 기준/)).toBeTruthy()
    expect(getFinancialTrends).toHaveBeenCalledWith('00126380', 'OFS')
  })
})
