import { describe, expect, it } from 'vitest'
import type { FinancialTrend, KeyAccountKey, TrendPeriod, TrendValue } from '@/shared/api/financialTrends'
import type { RatioResult } from '@/shared/lib/financialRatios'
import {
  addCompany,
  buildColumns,
  calculateAmountYoy,
  calculateRatioYoy,
  comparisonRows,
  findPreviousPeriod,
  formatAmount,
  loadKey,
  loadsReducer,
  parseCorps,
  parseFsDiv,
  parseReportType,
  periodsDiffer,
  pickLatestPeriod,
  removeCompany,
  serializeCorps,
  type LoadsState,
} from './companyComparison'

function period(
  rceptNo: string,
  reportType: TrendPeriod['reportType'],
  periodEnd: string,
  dataStatus: TrendPeriod['dataStatus'] = 'AVAILABLE',
  sourceRceptNo: string | null = rceptNo,
): TrendPeriod {
  return {
    rceptNo,
    reportType,
    reportName: `보고서 (${periodEnd})`,
    fiscalYear: Number(periodEnd.slice(0, 4)),
    periodEnd,
    dataStatus,
    sourceRceptNo: dataStatus === 'AVAILABLE' ? sourceRceptNo : null,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

function trend(periods: TrendPeriod[], amounts: Partial<Record<KeyAccountKey, (number | null)[]>>): FinancialTrend {
  return {
    corpCode: '00126380',
    fsDiv: 'CFS',
    refreshError: null,
    periods,
    accounts: (Object.entries(amounts) as [KeyAccountKey, (number | null)[]][]).map(([key, values]) => ({
      key,
      name: key,
      sjDiv: ['REVENUE', 'OPERATING_INCOME', 'NET_INCOME'].includes(key) ? 'IS' : 'BS',
      amountBasis: 'POINT',
      values: values.map((amount, i) => ({
        rceptNo: periods[i].rceptNo,
        amount,
        quarterAmount: null,
        currency: amount === null ? null : 'KRW',
      })),
    })),
  }
}

describe('주소의 비교 조건', () => {
  it('고유번호 8자리만 겹치지 않게 앞에서부터 4곳까지 읽는다', () => {
    expect(parseCorps('00126380,abc,00164779,00126380,00000001,00000002,00000003')).toEqual([
      '00126380',
      '00164779',
      '00000001',
      '00000002',
    ])
    expect(parseCorps(null)).toEqual([])
    expect(parseCorps('')).toEqual([])
  })

  it('고른 기업이 없으면 corps를 지운다', () => {
    expect(serializeCorps([])).toBeNull()
    expect(serializeCorps(['00126380', '00164779'])).toBe('00126380,00164779')
  })

  it('보고서 종류는 모르는 값이면 사업보고서, 재무제표 기준은 모르는 값이면 연결이다', () => {
    expect(parseReportType(null)).toBe('ANNUAL')
    expect(parseReportType('HALF')).toBe('HALF')
    expect(parseReportType('annual')).toBe('ANNUAL')
    expect(parseFsDiv('OFS')).toBe('OFS')
    expect(parseFsDiv('x')).toBe('CFS')
  })
})

describe('기업 더하기·빼기', () => {
  it('뒤에 더하고, 이미 있으면 그대로, 4곳이 차 있으면 더하지 않는다', () => {
    expect(addCompany(['00000001'], '00000002')).toEqual({ status: 'added', corps: ['00000001', '00000002'] })
    expect(addCompany(['00000001'], '00000001')).toEqual({ status: 'duplicate' })
    expect(addCompany(['00000001', '00000002', '00000003', '00000004'], '00000005')).toEqual({ status: 'full' })
  })

  it('뺀 기업만 지우고 나머지 순서는 그대로 둔다', () => {
    expect(removeCompany(['00000001', '00000002', '00000003'], '00000002')).toEqual(['00000001', '00000003'])
  })
})

describe('불러오기 상태', () => {
  const key = loadKey('00126380', 'CFS')
  const success = { status: 'success' as const, company: null, trend: trend([], {}) }

  it('불러오는 중일 때만 응답을 받는다', () => {
    const loading = loadsReducer({}, { type: 'start', key })
    expect(loading[key]).toEqual({ status: 'loading' })
    const done = loadsReducer(loading, { type: 'settle', key, load: success })
    expect(done[key]).toBe(success)
    expect(loadsReducer({}, { type: 'settle', key, load: success })).toEqual({})
  })

  it('취소한 요청(불러오는 중)만 지우고 받은 결과는 남긴다', () => {
    const other = loadKey('00164779', 'CFS')
    const state: LoadsState = { [key]: { status: 'loading' }, [other]: success }
    expect(loadsReducer(state, { type: 'drop', keys: [key, other] })).toEqual({ [other]: success })
  })
})

describe('비교할 기간 고르기', () => {
  it('고른 종류 중 대상 기간이 가장 최근이고 값이 있는 보고서를 고른다', () => {
    const periods = [
      period('20260814000001', 'HALF', '2026-06-30'),
      period('20260310000001', 'ANNUAL', '2025-12-31'),
      period('20250310000001', 'ANNUAL', '2024-12-31'),
    ]
    const pick = pickLatestPeriod(periods, 'ANNUAL')
    expect(pick).toMatchObject({ status: 'picked', index: 1, newerFailed: false })
  })

  it('최근 보고서 값을 받지 못했으면 이전 보고서를 고르고 그 사실을 남긴다', () => {
    const periods = [
      period('20260310000001', 'ANNUAL', '2025-12-31', 'FETCH_FAILED'),
      period('20250310000001', 'ANNUAL', '2024-12-31'),
    ]
    expect(pickLatestPeriod(periods, 'ANNUAL')).toMatchObject({ status: 'picked', index: 1, newerFailed: true })
  })

  it('고른 종류가 없으면 no-report, 값이 모두 없으면 no-data, 받지 못한 것뿐이면 fetch-failed', () => {
    expect(pickLatestPeriod([period('20260814000001', 'HALF', '2026-06-30')], 'ANNUAL')).toEqual({ status: 'no-report' })
    expect(pickLatestPeriod([period('20260310000001', 'ANNUAL', '2025-12-31', 'NOT_AVAILABLE')], 'ANNUAL')).toEqual({
      status: 'no-data',
    })
    expect(
      pickLatestPeriod(
        [
          period('20260310000001', 'ANNUAL', '2025-12-31', 'NOT_AVAILABLE'),
          period('20250310000001', 'ANNUAL', '2024-12-31', 'FETCH_FAILED'),
        ],
        'ANNUAL',
      ),
    ).toEqual({ status: 'fetch-failed' })
  })
})

describe('비교 표', () => {
  const samsung = trend([period('20260310000001', 'ANNUAL', '2025-12-31', 'AVAILABLE', '20260401000009')], {
    REVENUE: [300_000_000_000_000],
    OPERATING_INCOME: [30_000_000_000_000],
    NET_INCOME: [null],
    TOTAL_ASSETS: [500_000_000_000_000],
    TOTAL_LIABILITIES: [100_000_000_000_000],
    TOTAL_EQUITY: [400_000_000_000_000],
  })
  const lg = trend([period('20260320000001', 'ANNUAL', '2026-03-31')], {
    REVENUE: [0],
    TOTAL_EQUITY: [-10],
    TOTAL_LIABILITIES: [50],
  })
  const loads: LoadsState = {
    [loadKey('00126380', 'CFS')]: {
      status: 'success',
      company: { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true },
      trend: samsung,
    },
    [loadKey('00164779', 'CFS')]: { status: 'success', company: null, trend: lg },
    [loadKey('00000003', 'CFS')]: { status: 'error', company: null, error: new Error('x') },
  }

  it('열은 고른 순서이고 이름은 기업 정보 → 고를 때 본 이름 → 고유번호 순서로 쓴다', () => {
    const columns = buildColumns(['00164779', '00126380', '00000003', '00000004'], loads, 'CFS', 'ANNUAL', {
      '00164779': 'SK하이닉스',
    })
    expect(columns.map((c) => [c.corpCode, c.name, c.status])).toEqual([
      ['00164779', 'SK하이닉스', 'ready'],
      ['00126380', '삼성전자', 'ready'],
      ['00000003', '00000003', 'failed'],
      ['00000004', '00000004', 'loading'],
    ])
  })

  it('값의 근거는 정정 공시가 있으면 그 접수번호다', () => {
    const [column] = buildColumns(['00126380'], loads, 'CFS', 'ANNUAL', {})
    expect(column).toMatchObject({ status: 'ready', sourceRceptNo: '20260401000009' })
  })

  it('주요계정 6행 뒤에 비율 4행을 두고, 없는 계정은 0이 아니라 자료 없음이다', () => {
    const columns = buildColumns(['00126380', '00164779', '00000003'], loads, 'CFS', 'ANNUAL', {})
    const rows = comparisonRows(columns)
    expect(rows.map((r) => r.name)).toEqual([
      '매출액',
      '영업이익',
      '당기순이익',
      '자산총계',
      '부채총계',
      '자본총계',
      '부채비율',
      '유동비율',
      '영업이익률',
      '순이익률',
    ])
    expect(rows[0].cells).toEqual([
      { status: 'value', amount: 300_000_000_000_000, currency: 'KRW', yoy: null },
      { status: 'value', amount: 0, currency: 'KRW', yoy: null },
      { status: 'none' },
    ])
    expect(rows[2].cells[0]).toEqual({ status: 'missing' })
    expect(rows[1].cells[1]).toEqual({ status: 'missing' })
  })

  it('전년 동기 보고서가 있으면 주요계정과 비율에 전년 대비 증감 보조 줄이 들어간다', () => {
    const twoYearSamsung = trend(
      [
        period('20260310000001', 'ANNUAL', '2025-12-31'),
        period('20250310000001', 'ANNUAL', '2024-12-31'),
      ],
      {
        REVENUE: [300_000_000_000_000, 200_000_000_000_000],
        OPERATING_INCOME: [30_000_000_000_000, -10_000_000_000_000],
        NET_INCOME: [20_000_000_000_000, null],
        TOTAL_ASSETS: [500_000_000_000_000, 400_000_000_000_000],
        TOTAL_LIABILITIES: [100_000_000_000_000, 100_000_000_000_000],
        TOTAL_EQUITY: [400_000_000_000_000, 300_000_000_000_000],
      },
    )
    const twoYearLoads: LoadsState = {
      [loadKey('00126380', 'CFS')]: {
        status: 'success',
        company: { corpCode: '00126380', corpName: '삼성전자', stockCode: '005930', listed: true },
        trend: twoYearSamsung,
      },
    }
    const columns = buildColumns(['00126380'], twoYearLoads, 'CFS', 'ANNUAL', {})
    const rows = comparisonRows(columns)
    expect(columns[0]).toMatchObject({
      status: 'ready',
      period: { fiscalYear: 2025 },
      previousPeriod: { fiscalYear: 2024 },
    })

    // 매출액: 200조 -> 300조 (+50.0%)
    expect(rows[0].cells[0]).toEqual({
      status: 'value',
      amount: 300_000_000_000_000,
      currency: 'KRW',
      yoy: '전년 대비 ▲ +50.0%',
    })
    // 영업이익: -10조 -> 30조 (흑자전환)
    expect(rows[1].cells[0]).toEqual({
      status: 'value',
      amount: 30_000_000_000_000,
      currency: 'KRW',
      yoy: '전년 대비 흑자 전환',
    })
    // 당기순이익: 이전 값 미기재
    expect(rows[2].cells[0]).toEqual({
      status: 'value',
      amount: 20_000_000_000_000,
      currency: 'KRW',
      yoy: '전년 자료 없음',
    })
    // 부채비율: 2024년 100/300=33.3%, 2025년 100/400=25.0% (-8.3%p)
    const debtRatioRow = rows[6]
    if (debtRatioRow.kind !== 'ratio') throw new Error('부채비율 행이 아님')
    expect(debtRatioRow.cells[0]).toMatchObject({
      status: 'value',
      yoy: '전년 대비 ▼ −8.3%p',
    })
  })

  it('비율은 공통 계산 함수로 만들고, 계산하지 못하면 이유를 남긴다', () => {
    const rows = comparisonRows(buildColumns(['00126380', '00164779'], loads, 'CFS', 'ANNUAL', {}))
    const debt = rows[6]
    const margin = rows[8]
    if (debt.kind !== 'ratio' || margin.kind !== 'ratio') throw new Error('비율 행이 아님')
    expect(debt.cells[0]).toMatchObject({ status: 'value', result: { value: 25, reason: null } })
    expect(debt.cells[1]).toMatchObject({ status: 'value', result: { value: null, reason: 'DENOMINATOR_NEGATIVE' } })
    expect(margin.cells[0]).toMatchObject({ status: 'value', result: { value: 10 } })
    expect(margin.cells[1]).toMatchObject({ status: 'value', result: { reason: 'DENOMINATOR_ZERO' } })
  })

  it('준비된 열들의 대상 기간 끝이 다르면 기간이 다르다고 본다', () => {
    expect(periodsDiffer(buildColumns(['00126380', '00164779'], loads, 'CFS', 'ANNUAL', {}))).toBe(true)
    expect(periodsDiffer(buildColumns(['00126380', '00000003'], loads, 'CFS', 'ANNUAL', {}))).toBe(false)
  })

  it('고른 종류 보고서가 없는 기업은 그 열만 no-report다', () => {
    const columns = buildColumns(['00126380', '00164779'], loads, 'CFS', 'HALF', {})
    expect(columns.map((c) => c.status)).toEqual(['no-report', 'no-report'])
  })
})

describe('금액 표시', () => {
  it('원화는 조·억으로 줄이고 원을 붙인다. 원화가 아니면 통화 코드를 붙인다', () => {
    expect(formatAmount(305_372_914_000_000, 'KRW')).toBe('305.4조원')
    expect(formatAmount(-371_770_000_000, 'KRW')).toBe('−3717.7억원')
    expect(formatAmount(0, 'KRW')).toBe('0원')
    expect(formatAmount(1_500_000, 'USD')).toBe('150만 USD')
  })
})

describe('전년 동기 보고서 찾기', () => {
  it('같은 보고서 종류의 직전 회계연도이면서 AVAILABLE인 보고서를 찾는다', () => {
    const periods = [
      period('20260310000001', 'ANNUAL', '2025-12-31'),
      period('20250814000001', 'HALF', '2025-06-30'),
      period('20250310000001', 'ANNUAL', '2024-12-31'),
      period('20240310000001', 'ANNUAL', '2023-12-31'),
    ]
    const found = findPreviousPeriod(periods, 'ANNUAL', 2025)
    expect(found).not.toBeNull()
    expect(found?.period.rceptNo).toBe('20250310000001')
    expect(found?.index).toBe(2)
  })

  it('직전 연도 보고서가 없거나 자료가 없으면 null을 돌려준다', () => {
    const periods = [
      period('20260310000001', 'ANNUAL', '2025-12-31'),
      period('20250310000001', 'ANNUAL', '2024-12-31', 'NOT_AVAILABLE'),
    ]
    expect(findPreviousPeriod(periods, 'ANNUAL', 2025)).toBeNull()
    expect(findPreviousPeriod(periods, 'HALF', 2025)).toBeNull()
  })
})

describe('전년 동기 대비 증감률 및 변동폭 계산', () => {
  const val = (amount: number | null): TrendValue => ({
    rceptNo: '20260310000001',
    amount,
    quarterAmount: null,
    currency: 'KRW',
  })

  const ratio = (value: number | null, reason: RatioResult['reason'] = null): RatioResult => ({
    key: 'DEBT_RATIO',
    name: '부채비율',
    formula: '부채총계 ÷ 자본총계 × 100',
    numeratorName: '부채총계',
    denominatorName: '자본총계',
    numerator: 100,
    denominator: 400,
    currency: 'KRW',
    value,
    reason,
    sourceRceptNos: [],
  })

  it('전년 보고서가 없으면 주요계정과 비율 모두 null이다', () => {
    expect(calculateAmountYoy('REVENUE', val(100), val(80), false)).toBeNull()
    const curRatio = ratio(25)
    const prevRatio = ratio(20)
    expect(calculateRatioYoy(curRatio, prevRatio, false)).toBeNull()
  })

  it('주요계정에서 이전 값이 없으면 전년 자료 없음이고, 현재 값이 없으면 null이다', () => {
    expect(calculateAmountYoy('REVENUE', val(100), val(null), true)).toBe('전년 자료 없음')
    expect(calculateAmountYoy('REVENUE', val(null), val(80), true)).toBeNull()
  })

  it('주요계정의 정상 증감률을 부호와 기호로 계산한다', () => {
    expect(calculateAmountYoy('REVENUE', val(150), val(100), true)).toBe('전년 대비 ▲ +50.0%')
    expect(calculateAmountYoy('REVENUE', val(75), val(100), true)).toBe('전년 대비 ▼ −25.0%')
    expect(calculateAmountYoy('REVENUE', val(100), val(100), true)).toBe('전년과 같음 (0.0%)')
  })

  it('주요계정의 이전 값 0, 흑자 전환, 적자 전환, 전년 음수를 사유로 구분한다', () => {
    expect(calculateAmountYoy('REVENUE', val(100), val(0), true)).toBe('전년 대비 (전년 0)')
    expect(calculateAmountYoy('OPERATING_INCOME', val(50), val(-30), true)).toBe('전년 대비 흑자 전환')
    expect(calculateAmountYoy('NET_INCOME', val(-20), val(80), true)).toBe('전년 대비 적자 전환')
    expect(calculateAmountYoy('OPERATING_INCOME', val(-40), val(-10), true)).toBe('전년 대비 (전년 음수)')
    expect(calculateAmountYoy('TOTAL_EQUITY', val(50), val(-20), true)).toBe('전년 대비 (전년 음수)')
  })

  it('재무 비율의 전년 대비 변동폭(%p)을 계산한다', () => {
    const curRatio = ratio(25.4)
    const prevRatio = ratio(22.0)
    expect(calculateRatioYoy(curRatio, prevRatio, true)).toBe('전년 대비 ▲ +3.4%p')

    const lowerRatio = ratio(20.8)
    expect(calculateRatioYoy(lowerRatio, prevRatio, true)).toBe('전년 대비 ▼ −1.2%p')

    const sameRatio = ratio(22.0)
    expect(calculateRatioYoy(sameRatio, prevRatio, true)).toBe('전년 대비 0.0%p')
  })

  it('재무 비율에서 이전 또는 현재 비율이 계산 불가면 변동폭을 생략한다', () => {
    const curRatio = ratio(25.4)
    const nullRatio = ratio(null, 'DENOMINATOR_NEGATIVE')
    expect(calculateRatioYoy(curRatio, nullRatio, true)).toBeNull()
    expect(calculateRatioYoy(nullRatio, curRatio, true)).toBeNull()
  })
})
