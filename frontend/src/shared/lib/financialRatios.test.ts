import { describe, expect, it } from 'vitest'
import type { FinancialTrend, KeyAccountKey, TrendPeriod, TrendValue } from '@/shared/api/financialTrends'
import {
  RATIO_DEFINITIONS,
  computeRatio,
  formatRatio,
  isIncomeRatio,
  periodRatios,
  periodSourceRceptNo,
  ratioReasonLabel,
  type RatioKey,
  type RatioResult,
} from './financialRatios'

const krw = (amount: number | null) => ({ amount, currency: amount === null ? null : 'KRW' })
const def = (key: RatioKey) => RATIO_DEFINITIONS.find((d) => d.key === key)!

function period(rceptNo: string, reportType: TrendPeriod['reportType'], sourceRceptNo: string | null = rceptNo): TrendPeriod {
  return {
    rceptNo,
    reportType,
    reportName: '보고서',
    fiscalYear: 2026,
    periodEnd: '2026-06-30',
    dataStatus: 'AVAILABLE',
    sourceRceptNo,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

const IS_KEYS: readonly KeyAccountKey[] = ['REVENUE', 'OPERATING_INCOME', 'NET_INCOME']

/** 기간 하나짜리 응답. 값은 [누적, 3개월] */
function trend(values: Partial<Record<KeyAccountKey, [number | null, number | null]>>, p: TrendPeriod): FinancialTrend {
  return {
    corpCode: '00126380',
    fsDiv: 'CFS',
    refreshError: null,
    periods: [p],
    accounts: (Object.keys(values) as KeyAccountKey[]).map((key) => {
      const [amount, quarterAmount] = values[key]!
      const value: TrendValue = { rceptNo: p.rceptNo, amount, quarterAmount, currency: amount === null ? null : 'KRW' }
      return {
        key,
        name: key,
        sjDiv: IS_KEYS.includes(key) ? 'IS' : 'BS',
        amountBasis: IS_KEYS.includes(key) ? 'CUMULATIVE' : 'POINT',
        values: [value],
      }
    }),
  }
}

const byKey = (results: RatioResult[], key: RatioKey) => results.find((r) => r.key === key)!

describe('재무 비율 계산', () => {
  it('네 비율의 계산식은 분자 ÷ 분모 × 100이다', () => {
    expect(RATIO_DEFINITIONS.map((d) => [d.name, d.formula])).toEqual([
      ['부채비율', '부채총계 ÷ 자본총계 × 100'],
      ['유동비율', '유동자산 ÷ 유동부채 × 100'],
      ['영업이익률', '영업이익 ÷ 매출액 × 100'],
      ['순이익률', '당기순이익 ÷ 매출액 × 100'],
    ])
  })

  it('영업이익률·순이익률만 손익 금액이 들어간 비율이다', () => {
    expect(RATIO_DEFINITIONS.filter((d) => isIncomeRatio(d.key)).map((d) => d.name)).toEqual(['영업이익률', '순이익률'])
  })

  it('두 금액과 근거 접수번호를 결과에 함께 담는다', () => {
    const result = computeRatio(def('DEBT_RATIO'), krw(150), krw(200), ['20260814003699', '20260814003699'])
    expect(result).toMatchObject({
      value: 75,
      reason: null,
      numerator: 150,
      denominator: 200,
      currency: 'KRW',
      sourceRceptNos: ['20260814003699'],
    })
  })

  it('분자가 음수(영업손실)면 음수 비율로 계산한다', () => {
    expect(computeRatio(def('OPERATING_MARGIN'), krw(-30), krw(200), []).value).toBe(-15)
  })

  it('분자가 0이면 0%로 계산하고 값 없음과 구분한다', () => {
    const zero = computeRatio(def('NET_MARGIN'), krw(0), krw(200), [])
    expect(zero.value).toBe(0)
    expect(zero.reason).toBeNull()
    const missing = computeRatio(def('NET_MARGIN'), krw(null), krw(200), [])
    expect(missing.value).toBeNull()
    expect(missing.reason).toBe('NUMERATOR_MISSING')
  })

  it('분모가 없으면 0으로 보지 않고 DENOMINATOR_MISSING이다', () => {
    const result = computeRatio(def('OPERATING_MARGIN'), krw(30), krw(null), [])
    expect(result.value).toBeNull()
    expect(result.reason).toBe('DENOMINATOR_MISSING')
    expect(result.denominator).toBeNull()
  })

  it('분모가 0이면 DENOMINATOR_ZERO다', () => {
    expect(computeRatio(def('CURRENT_RATIO'), krw(30), krw(0), []).reason).toBe('DENOMINATOR_ZERO')
  })

  it('자본총계가 음수(자본잠식)면 부채비율을 계산하지 않고 DENOMINATOR_NEGATIVE다', () => {
    const result = computeRatio(def('DEBT_RATIO'), krw(500), krw(-100), [])
    expect(result.value).toBeNull()
    expect(result.reason).toBe('DENOMINATOR_NEGATIVE')
  })

  it('분자와 분모가 모두 없으면 분모 이유를 먼저 든다', () => {
    expect(computeRatio(def('DEBT_RATIO'), krw(null), krw(null), []).reason).toBe('DENOMINATOR_MISSING')
  })
})

describe('기간 하나의 비율', () => {
  const values: Partial<Record<KeyAccountKey, [number | null, number | null]>> = {
    TOTAL_LIABILITIES: [300, null],
    TOTAL_EQUITY: [600, null],
    CURRENT_ASSETS: [250, null],
    CURRENT_LIABILITIES: [100, null],
    REVENUE: [1000, 400],
    OPERATING_INCOME: [100, 60],
    NET_INCOME: [50, 20],
  }

  it('누적 기준이면 손익은 누적 금액으로 계산한다', () => {
    const results = periodRatios(trend(values, period('20260814003699', 'HALF')), 0, 'CUMULATIVE')
    expect(results.map((r) => [r.key, r.value])).toEqual([
      ['DEBT_RATIO', 50],
      ['CURRENT_RATIO', 250],
      ['OPERATING_MARGIN', 10],
      ['NET_MARGIN', 5],
    ])
  })

  it('3개월 기준이면 손익은 3개월 금액으로 계산하고 연환산하지 않는다', () => {
    const results = periodRatios(trend(values, period('20260814003699', 'HALF')), 0, 'QUARTER')
    expect(byKey(results, 'OPERATING_MARGIN')).toMatchObject({ value: 15, numerator: 60, denominator: 400 })
    expect(byKey(results, 'NET_MARGIN').value).toBe(5)
    // 재무상태표 비율은 기준과 관계없다
    expect(byKey(results, 'DEBT_RATIO').value).toBe(50)
  })

  it('사업보고서는 3개월을 골라도 누적(1년) 금액으로 계산한다', () => {
    const annual = { ...values, REVENUE: [1000, null], OPERATING_INCOME: [100, null] } as typeof values
    const results = periodRatios(trend(annual, period('20260310000001', 'ANNUAL')), 0, 'QUARTER')
    expect(byKey(results, 'OPERATING_MARGIN').value).toBe(10)
  })

  it('매출액이 없는 기업은 영업이익률·순이익률만 계산하지 않는다', () => {
    const noRevenue = { ...values, REVENUE: [null, null] } as typeof values
    const results = periodRatios(trend(noRevenue, period('20260814003699', 'HALF')), 0, 'CUMULATIVE')
    expect(results.map((r) => r.reason)).toEqual([null, null, 'DENOMINATOR_MISSING', 'DENOMINATOR_MISSING'])
    expect(ratioReasonLabel(byKey(results, 'OPERATING_MARGIN'))).toBe('계산 불가 · 매출액 미기재')
  })

  it('응답에 계정이 아예 없으면 값 없음으로 본다', () => {
    const results = periodRatios(trend({ TOTAL_EQUITY: [600, null] }, period('20260814003699', 'HALF')), 0, 'CUMULATIVE')
    expect(byKey(results, 'DEBT_RATIO').reason).toBe('NUMERATOR_MISSING')
    expect(byKey(results, 'CURRENT_RATIO').reason).toBe('DENOMINATOR_MISSING')
  })

  it('정정 공시 값이면 근거는 그 공시의 접수번호다', () => {
    const p = period('20250814003156', 'HALF', '20260101000001')
    expect(periodSourceRceptNo(p)).toBe('20260101000001')
    expect(byKey(periodRatios(trend(values, p), 0, 'CUMULATIVE'), 'DEBT_RATIO').sourceRceptNos).toEqual(['20260101000001'])
    expect(periodSourceRceptNo({ rceptNo: '20250814003156', sourceRceptNo: null })).toBe('20250814003156')
  })
})

describe('계산 불가 문구', () => {
  const label = (key: RatioKey, numerator: number | null, denominator: number | null) =>
    ratioReasonLabel(computeRatio(def(key), krw(numerator), krw(denominator), []))

  it('이유마다 짧은 문구를 보이고 받침에 맞게 조사를 붙인다', () => {
    expect(label('OPERATING_MARGIN', 1, null)).toBe('계산 불가 · 매출액 미기재')
    expect(label('OPERATING_MARGIN', 1, 0)).toBe('계산 불가 · 매출액이 0')
    expect(label('DEBT_RATIO', 1, -5)).toBe('계산 불가 · 자본총계가 음수')
    expect(label('CURRENT_RATIO', 1, 0)).toBe('계산 불가 · 유동부채가 0')
    expect(label('NET_MARGIN', null, 10)).toBe('계산 불가 · 당기순이익 미기재')
  })

  it('계산했으면 문구가 없다', () => {
    expect(label('DEBT_RATIO', 1, 2)).toBeNull()
  })
})

describe('비율 표시', () => {
  it('소수 첫째 자리로 반올림해 보인다', () => {
    expect(formatRatio(25.44)).toBe('25.4%')
    expect(formatRatio(25.46)).toBe('25.5%')
    expect(formatRatio(1234.56)).toBe('1,234.6%')
    expect(formatRatio(100)).toBe('100.0%')
  })

  it('음수는 − 기호를 붙이고 0에 가까운 값은 0.0%다', () => {
    expect(formatRatio(-3.21)).toBe('−3.2%')
    expect(formatRatio(-0.01)).toBe('0.0%')
    expect(formatRatio(0)).toBe('0.0%')
  })

  it('계산하지 못한 값은 숫자로 만들지 않는다', () => {
    expect(formatRatio(null)).toBeNull()
  })
})
