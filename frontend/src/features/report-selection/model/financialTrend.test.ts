import { describe, expect, it } from 'vitest'
import type { FinancialTrend, TrendAccount, TrendPeriod, TrendValue } from '@/shared/api/financialTrends'
import type { ReportType } from '@/shared/api/reports'
import {
  accountSummary,
  availableReportTypes,
  basisNote,
  chartAccounts,
  columnBars,
  effectiveBasis,
  failedCount,
  formatChartAmount,
  formatTrendAmount,
  periodShortLabel,
  selectedReportType,
  tableUnitLabel,
  trendSeries,
} from './financialTrend'

function period(rceptNo: string, reportType: ReportType, fiscalYear: number, periodEnd: string,
  dataStatus: TrendPeriod['dataStatus'] = 'AVAILABLE'): TrendPeriod {
  return {
    rceptNo,
    reportType,
    reportName: `${reportType} (${periodEnd})`,
    fiscalYear,
    periodEnd,
    dataStatus,
    sourceRceptNo: dataStatus === 'AVAILABLE' ? rceptNo : null,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

function value(rceptNo: string, amount: number | null, quarterAmount: number | null = null): TrendValue {
  return { rceptNo, amount, quarterAmount, currency: amount === null && quarterAmount === null ? null : 'KRW' }
}

// 삼성전자 연결 기준 실제 값(OpenDART 주요계정): 2026 반기 20260814003699, 2025 반기 20250814003156,
// 2026 1분기 20260515002181, 2025 사업 20260310002820
const periods: TrendPeriod[] = [
  period('20260814003699', 'HALF', 2026, '2026-06-30'),
  period('20260515002181', 'Q1', 2026, '2026-03-31'),
  period('20260310002820', 'ANNUAL', 2025, '2025-12-31'),
  period('20251114002447', 'Q3', 2025, '2025-09-30', 'FETCH_FAILED'),
  period('20250814003156', 'HALF', 2025, '2025-06-30'),
]

function account(key: TrendAccount['key'], name: string, sjDiv: 'BS' | 'IS', values: TrendValue[]): TrendAccount {
  return { key, name, sjDiv, amountBasis: sjDiv === 'BS' ? 'POINT' : 'CUMULATIVE', values }
}

const trend: FinancialTrend = {
  corpCode: '00126380',
  fsDiv: 'CFS',
  refreshError: null,
  periods,
  accounts: [
    account('TOTAL_ASSETS', '자산총계', 'BS', [
      value(periods[0].rceptNo, 759_480_516_000_000),
      value(periods[1].rceptNo, null),
      value(periods[2].rceptNo, 566_942_110_000_000),
      value(periods[3].rceptNo, null),
      value(periods[4].rceptNo, null),
    ]),
    account('REVENUE', '매출액', 'IS', [
      value(periods[0].rceptNo, 305_372_914_000_000, 171_499_470_000_000),
      value(periods[1].rceptNo, 133_873_444_000_000, 133_873_444_000_000),
      value(periods[2].rceptNo, 333_605_938_000_000),
      value(periods[3].rceptNo, null),
      value(periods[4].rceptNo, 153_706_820_000_000, 74_566_317_000_000),
    ]),
    account('OPERATING_INCOME', '영업이익', 'IS', [
      value(periods[0].rceptNo, 146_725_209_000_000, 89_492_412_000_000),
      value(periods[1].rceptNo, null),
      value(periods[2].rceptNo, null),
      value(periods[3].rceptNo, null),
      value(periods[4].rceptNo, 0, 0),
    ]),
    account('CAPITAL_STOCK', '자본금', 'BS', periods.map((p) => value(p.rceptNo, null))),
  ],
}

describe('보고서 종류 고르기', () => {
  it('응답에 있는 종류만 사업·반기·1분기·3분기 순으로 보인다', () => {
    expect(availableReportTypes(periods)).toEqual(['ANNUAL', 'HALF', 'Q1', 'Q3'])
    expect(availableReportTypes(periods.slice(0, 1))).toEqual(['HALF'])
  })

  it('기본은 가장 최근 보고서의 종류이고, 고른 종류가 없으면 기본으로 돌아간다', () => {
    expect(selectedReportType(periods, null)).toBe('HALF')
    expect(selectedReportType(periods, 'ANNUAL')).toBe('ANNUAL')
    expect(selectedReportType(periods.slice(0, 1), 'ANNUAL')).toBe('HALF')
    expect(selectedReportType([], null)).toBeNull()
  })

  it('사업보고서는 3개월 값이 없어 늘 누적이다', () => {
    expect(effectiveBasis('ANNUAL', 'QUARTER')).toBe('CUMULATIVE')
    expect(effectiveBasis('HALF', 'QUARTER')).toBe('QUARTER')
  })
})

describe('trendSeries', () => {
  it('같은 종류 보고서만 오래된 기간부터 놓고 손익은 누적 금액을 쓴다', () => {
    const series = trendSeries(trend, 'HALF', 'CUMULATIVE')
    expect(series.periods.map((p) => p.rceptNo)).toEqual(['20250814003156', '20260814003699'])
    const revenue = series.accounts.find((a) => a.key === 'REVENUE')
    expect(revenue?.points.map((p) => p.amount)).toEqual([153_706_820_000_000, 305_372_914_000_000])
  })

  it('3개월 기준이면 손익은 3개월 금액, 재무상태표는 그대로 기말 잔액이다', () => {
    const series = trendSeries(trend, 'HALF', 'QUARTER')
    expect(series.accounts.find((a) => a.key === 'REVENUE')?.points.map((p) => p.amount)).toEqual([
      74_566_317_000_000, 171_499_470_000_000,
    ])
    expect(series.accounts.find((a) => a.key === 'TOTAL_ASSETS')?.points.map((p) => p.amount)).toEqual([
      null, 759_480_516_000_000,
    ])
  })

  it('없는 값은 null로 두고 0과 구분하며, 내내 값이 없는 계정은 따로 알린다', () => {
    const series = trendSeries(trend, 'HALF', 'CUMULATIVE')
    expect(series.accounts.find((a) => a.key === 'OPERATING_INCOME')?.points.map((p) => p.amount)).toEqual([
      0, 146_725_209_000_000,
    ])
    expect(series.accounts.find((a) => a.key === 'TOTAL_ASSETS')?.points[0].amount).toBeNull()
    expect(series.emptyAccounts).toEqual(['자본금'])
    expect(trendSeries(trend, 'Q3', 'CUMULATIVE').accounts).toEqual([])
  })

  it('차트는 정해 둔 계정 순서로 고른다', () => {
    const series = trendSeries(trend, 'HALF', 'CUMULATIVE')
    expect(chartAccounts(series).map((a) => a.key)).toEqual(['REVENUE', 'OPERATING_INCOME', 'TOTAL_ASSETS'])
  })

  it('받지 못한 보고서를 센다', () => {
    expect(failedCount(periods)).toBe(1)
  })
})

describe('문구', () => {
  it('기간 이름과 금액 기준을 밝힌다', () => {
    expect(periodShortLabel(periods[0])).toBe('2026 반기')
    expect(periodShortLabel(periods[2])).toBe('2025 사업')
    expect(basisNote('HALF', 'CUMULATIVE', 'CFS', '2026-06-30')).toBe(
      '연결 기준 · 재무상태표는 기말(06.30) 잔액, 손익은 사업연도 시작부터 누적(01.01 ~ 06.30)이에요.',
    )
    expect(basisNote('Q3', 'QUARTER', 'OFS', '2025-09-30')).toBe(
      '별도 기준 · 재무상태표는 기말(09.30) 잔액, 손익은 그 분기 3개월이에요.',
    )
    expect(basisNote('ANNUAL', 'QUARTER', 'CFS', null)).toBe(
      '연결 기준 · 재무상태표는 기말 잔액, 손익은 사업연도 1년(01.01 ~ 12.31)이에요.',
    )
  })

  it('표 금액은 백만원이고 없는 값은 0이 아니라 —다', () => {
    expect(formatTrendAmount(305_372_914_000_000)).toBe('305,372,914')
    expect(formatTrendAmount(-3_454_670_000_000)).toBe('−3,454,670')
    expect(formatTrendAmount(0)).toBe('0')
    expect(formatTrendAmount(null)).toBe('—')
    expect(formatTrendAmount(400_000)).toBe('1 미만')
    expect(tableUnitLabel(trendSeries(trend, 'HALF', 'CUMULATIVE'))).toBe('백만원')
  })

  it('차트 값은 조·억으로 줄이고 없는 값은 값 없음이라고 읽어 준다', () => {
    expect(formatChartAmount(305_372_914_000_000, 'KRW')).toBe('305.4조원')
    expect(formatChartAmount(null, null)).toBe('값 없음')
    const series = trendSeries(trend, 'HALF', 'CUMULATIVE')
    const assets = series.accounts.find((a) => a.key === 'TOTAL_ASSETS')
    expect(assets && accountSummary(assets)).toBe('자산총계: 2025 반기 값 없음, 2026 반기 759.5조원')
  })
})

describe('columnBars', () => {
  it('0에서 값까지 막대를 놓고 없는 값은 막대를 만들지 않는다', () => {
    const { scale, bars } = columnBars([100, null, -50])
    expect(scale.min).toBeLessThan(0)
    expect(bars[1]).toBeNull()
    expect(bars[0]?.negative).toBe(false)
    expect(bars[2]?.negative).toBe(true)
    const zero = ((0 - scale.min) / (scale.max - scale.min)) * 100
    expect(bars[0]?.bottom).toBeCloseTo(zero)
    expect((bars[2]?.bottom ?? 0) + (bars[2]?.height ?? 0)).toBeCloseTo(zero)
  })

  it('값이 모두 없으면 막대가 없다', () => {
    expect(columnBars([null, null]).bars).toEqual([null, null])
  })
})
