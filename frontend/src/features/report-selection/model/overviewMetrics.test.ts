import { describe, expect, it } from 'vitest'
import type { FinancialTrend, TrendAccount, TrendPeriod } from '@/shared/api/financialTrends'
import type { ReportType } from '@/shared/api/reports'
import {
  annualPeriodLabel,
  formatMetricRate,
  hasMetricValues,
  metricChange,
  metricItem,
  overviewMetrics,
} from './overviewMetrics'

function period(rceptNo: string, reportType: ReportType, fiscalYear: number, periodEnd: string,
  dataStatus: TrendPeriod['dataStatus'] = 'AVAILABLE'): TrendPeriod {
  return {
    rceptNo,
    reportType,
    reportName: `사업보고서 (${periodEnd.slice(0, 7).replace('-', '.')})`,
    fiscalYear,
    periodEnd,
    dataStatus,
    sourceRceptNo: dataStatus === 'AVAILABLE' ? rceptNo : null,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

function account(key: TrendAccount['key'], name: string, amounts: (number | null)[], rceptNos: string[]): TrendAccount {
  return {
    key,
    name,
    sjDiv: 'IS',
    amountBasis: 'CUMULATIVE',
    values: amounts.map((amount, i) => ({ rceptNo: rceptNos[i], amount, quarterAmount: null, currency: amount === null ? null : 'KRW' })),
  }
}

// 최근 순서: 2026 반기, 2025 사업, 2024 사업
const rceptNos = ['20260814003699', '20260310002820', '20250311001085']
const trend: FinancialTrend = {
  corpCode: '00126380',
  fsDiv: 'CFS',
  refreshError: null,
  periods: [
    period(rceptNos[0], 'HALF', 2026, '2026-06-30'),
    period(rceptNos[1], 'ANNUAL', 2025, '2025-12-31'),
    period(rceptNos[2], 'ANNUAL', 2024, '2024-12-31'),
  ],
  accounts: [
    account('REVENUE', '매출액', [150, 300, 250], rceptNos),
    account('OPERATING_INCOME', '영업이익', [10, 20, null], rceptNos),
    account('NET_INCOME', '당기순이익', [5, 8, -4], rceptNos),
  ],
}

describe('overviewMetrics', () => {
  it('가장 최근 사업보고서와 한 해 전 사업보고서 값을 고른다(반기 보고서는 쓰지 않는다)', () => {
    const metrics = overviewMetrics(trend)
    expect(metrics?.latest.rceptNo).toBe(rceptNos[1])
    expect(metrics?.previous?.rceptNo).toBe(rceptNos[2])
    expect(metrics?.items.map((i) => [i.name, i.amount, i.previousAmount])).toEqual([
      ['매출액', 300, 250],
      ['영업이익', 20, null],
      ['당기순이익', 8, -4],
    ])
  })

  it('증감액과 증감률을 코드가 계산하고, 전기 값이 없으면 사유를 남긴다', () => {
    const [revenue, operating, net] = overviewMetrics(trend)?.items ?? []
    expect(revenue.change).toBe(50)
    expect(revenue.rate).toBeCloseTo(0.2)
    expect(operating).toMatchObject({ change: null, rate: null, reason: '전기 값이 없어요.' })
    expect(net).toMatchObject({ change: 12, rate: null, reason: '흑자전환' })
  })

  it('최근 사업보고서 값을 받지 못했으면 값을 받은 그 전 사업보고서를 쓴다', () => {
    const failed: FinancialTrend = {
      ...trend,
      periods: trend.periods.map((p, i) => (i === 1 ? { ...p, dataStatus: 'FETCH_FAILED', sourceRceptNo: null } : p)),
    }
    expect(overviewMetrics(failed)?.latest.rceptNo).toBe(rceptNos[2])
    expect(overviewMetrics(failed)?.previous).toBeNull()
  })

  it('사업보고서가 없으면 null이고, 값이 하나도 없으면 값 없음으로 본다', () => {
    expect(overviewMetrics({ ...trend, periods: [trend.periods[0]] })).toBeNull()
    const empty = { ...trend, accounts: [] }
    expect(hasMetricValues(overviewMetrics(empty))).toBe(false)
    expect(hasMetricValues(overviewMetrics(trend))).toBe(true)
    expect(hasMetricValues(null)).toBe(false)
  })
})

describe('metricItem', () => {
  it('현재 값이 없으면 0이 아니라 null로 둔다', () => {
    expect(metricItem('REVENUE', '매출액', null, 100, null)).toMatchObject({ amount: null, change: null, rate: null })
  })

  it('전기 값이 0이면 증감률을 계산하지 않는다', () => {
    expect(metricItem('REVENUE', '매출액', 100, 0, 'KRW')).toMatchObject({
      change: 100,
      rate: null,
      reason: '전기 값이 0이라 증감률을 계산하지 않아요.',
    })
  })

  it('이익 계정의 부호가 바뀌거나 음수가 이어지면 흑자·적자 표현을, 그 밖의 계정은 사유를 쓴다', () => {
    expect(metricItem('OPERATING_INCOME', '영업이익', -10, 5, 'KRW').reason).toBe('적자전환')
    expect(metricItem('NET_INCOME', '당기순이익', -3, -10, 'KRW').reason).toBe('적자폭 축소')
    expect(metricItem('NET_INCOME', '당기순이익', -12, -10, 'KRW').reason).toBe('적자폭 확대')
    expect(metricItem('REVENUE', '매출액', -1, 5, 'KRW').reason).toBe('부호가 바뀌어 증감률을 계산하지 않아요.')
    expect(metricItem('REVENUE', '매출액', 5, -1, 'KRW').reason).toBe('전기 값이 음수라 증감률을 계산하지 않아요.')
  })
})

describe('지표 문구', () => {
  it('증감은 방향과 절댓값, 부호가 붙은 증감률이다', () => {
    const down = metricItem('REVENUE', '매출액', 152_000_000_000_000, 160_000_000_000_000, 'KRW')
    expect(metricChange(down)).toEqual({ direction: 'down', amount: '8조원', rate: '−5.0%' })
    expect(metricChange(metricItem('REVENUE', '매출액', 100, 100, 'KRW'))?.direction).toBe('same')
    expect(metricChange(metricItem('REVENUE', '매출액', 100, null, 'KRW'))).toBeNull()
  })

  it('증감률은 소수 첫째 자리까지 부호를 붙인다', () => {
    expect(formatMetricRate(0.048276)).toBe('+4.8%')
    expect(formatMetricRate(-0.05)).toBe('−5.0%')
    expect(formatMetricRate(0.00001)).toBe('0.0%')
  })

  it('사업보고서 손익 기간은 사업연도와 기말로 적는다', () => {
    expect(annualPeriodLabel({ fiscalYear: 2025, periodEnd: '2025-12-31' })).toBe('2025 사업연도(~ 2025.12.31)')
  })
})
