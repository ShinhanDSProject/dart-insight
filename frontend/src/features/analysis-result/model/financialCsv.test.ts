import { describe, expect, it } from 'vitest'
import type { FinancialChangeItem } from '@/shared/api/results'
import { CSV_HEADER, buildFinancialCsv, calcStatusCell, csvCell, csvFileName, rateCell } from './financialCsv'

function item(overrides: Partial<FinancialChangeItem> = {}): FinancialChangeItem {
  return {
    changeId: 1,
    sjDiv: 'BS',
    accountName: '자산총계',
    accountDetail: null,
    amountBasis: 'POINT',
    previousAmount: 448_424_507_000_000,
    currentAmount: 485_757_000_000_000,
    changeAmount: 37_332_493_000_000,
    changeRate: 0.0833,
    direction: 'UP',
    calcStatus: 'OK',
    calcMessage: null,
    currency: 'KRW',
    scale: { base: 'TOTAL_ASSETS', baseAccountName: null, baseAmount: null, ratio: null, reason: 'BASE_NOT_FOUND' },
    ...overrides,
  }
}

const input = {
  statementLabel: '재무상태표',
  previousRceptNo: '20250814001234',
  currentRceptNo: '20260814005678',
}

function rowsOf(csv: string): string[] {
  return csv.slice(1).split('\r\n').slice(0, -1)
}

describe('buildFinancialCsv', () => {
  it('UTF-8 BOM으로 시작하고 CRLF로 줄을 나누며 마지막 줄도 CRLF로 끝난다', () => {
    const csv = buildFinancialCsv({ ...input, items: [item()] })
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.endsWith('\r\n')).toBe(true)
    expect(csv.slice(1).split('\r\n')).toHaveLength(3)
    expect(csv.replaceAll('\r\n', '')).not.toContain('\n')
  })

  it('머리글 다음에 계정마다 한 줄, 금액은 원 단위 정수 그대로 적는다', () => {
    const [header, row] = rowsOf(buildFinancialCsv({ ...input, items: [item()] }))
    expect(header).toBe(CSV_HEADER.join(','))
    expect(row).toBe(
      '재무상태표,자산총계,448424507000000,485757000000000,37332493000000,8.33,계산됨,KRW,20250814001234,20260814005678',
    )
  })

  it('없는 값은 0이 아니라 빈 칸으로 두고 계산 상태에 사유를 적는다', () => {
    const missing = item({
      previousAmount: null,
      changeAmount: null,
      changeRate: null,
      calcStatus: 'ONLY_CURRENT',
      currency: null,
    })
    const [, row] = rowsOf(buildFinancialCsv({ ...input, items: [missing] }))
    expect(row).toBe('재무상태표,자산총계,,485757000000000,,,계산 불가 · 이전 보고서에 없는 계정,,20250814001234,20260814005678')
  })

  it('0은 빈 칸이 아니라 0으로 적는다', () => {
    const zero = item({ previousAmount: 0, changeAmount: 5, changeRate: null, calcStatus: 'PREVIOUS_ZERO' })
    const [, row] = rowsOf(buildFinancialCsv({ ...input, items: [zero] }))
    expect(row.split(',').slice(2, 6)).toEqual(['0', '485757000000000', '5', ''])
  })

  it('음수 증감은 부호를 그대로 둔다', () => {
    const down = item({ changeAmount: -1_200, changeRate: -0.12345 })
    const [, row] = rowsOf(buildFinancialCsv({ ...input, items: [down] }))
    expect(row.split(',').slice(4, 6)).toEqual(['-1200', '-12.35'])
  })

  it('계정 이름의 쉼표·큰따옴표·줄바꿈은 큰따옴표로 감싸 한 칸으로 남긴다', () => {
    const odd = item({ accountName: '기타, "특수"\n계정' })
    const csv = buildFinancialCsv({ ...input, items: [odd] })
    expect(csv).toContain(',"기타, ""특수""\n계정",')
  })

  it('수식으로 읽힐 수 있는 글자 칸은 앞에 작은따옴표를 붙인다', () => {
    const formula = item({ accountName: '=HYPERLINK("x")' })
    const csv = buildFinancialCsv({ ...input, items: [formula] })
    expect(csv).toContain(`,"'=HYPERLINK(""x"")",`)
  })

  it('계정이 없으면 머리글만 있다', () => {
    expect(rowsOf(buildFinancialCsv({ ...input, items: [] }))).toEqual([CSV_HEADER.join(',')])
  })
})

describe('csvCell', () => {
  it('특수 글자가 없으면 그대로, 있으면 큰따옴표로 감싼다', () => {
    expect(csvCell('자산총계')).toBe('자산총계')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('a"b')).toBe('"a""b"')
    expect(csvCell('a\r\nb')).toBe('"a\r\nb"')
    expect(csvCell('')).toBe('')
  })
})

describe('rateCell', () => {
  it('비율을 100배해 소수 둘째 자리까지 적고 끝의 0은 뺀다', () => {
    expect(rateCell(0.153)).toBe('15.3')
    expect(rateCell(0.0833)).toBe('8.33')
    expect(rateCell(1)).toBe('100')
    expect(rateCell(-0.000001)).toBe('0')
    expect(rateCell(null)).toBe('')
  })
})

describe('calcStatusCell', () => {
  it('계산했으면 계산됨, 아니면 표와 같은 짧은 사유, 모르는 상태는 코드 그대로', () => {
    expect(calcStatusCell('OK')).toBe('계산됨')
    expect(calcStatusCell('AMBIGUOUS_MATCH')).toBe('검토 필요 · 같은 계정이 여러 개')
    expect(calcStatusCell('TURNED_PROFIT')).toBe('흑자전환')
    expect(calcStatusCell('NEW_STATUS')).toBe('NEW_STATUS')
  })
})

describe('csvFileName', () => {
  it('회사_이전_현재_재무제표.csv로 만든다', () => {
    expect(csvFileName('삼성전자', '반기보고서 (2025.06)', '반기보고서 (2026.06)', '재무상태표')).toBe(
      '삼성전자_반기보고서 (2025.06)_반기보고서 (2026.06)_재무상태표.csv',
    )
  })

  it('파일 이름에 쓸 수 없는 글자는 _로 바꾸고 앞뒤 공백·마침표를 뺀다', () => {
    expect(csvFileName('A/B:C*', ' [기재정정]사업보고서 ', '분기?"보고서"<1>|', '손익계산서.')).toBe(
      'A_B_C__[기재정정]사업보고서_분기__보고서__1___손익계산서.csv',
    )
  })

  it('이름이 모두 비면 기본 이름을 쓴다', () => {
    expect(csvFileName('', ' ', '..', '')).toBe('재무수치변화.csv')
  })

  it('자본변동표 계정은 구성요소 이름을 붙여 같은 이름의 줄을 구분한다(#401)', () => {
    const csv = buildFinancialCsv({
      statementLabel: '자본변동표',
      items: [item({ accountName: '기초자본', accountDetail: '자본 [구성요소]|이익잉여금 [구성요소]' })],
      previousRceptNo: '20250311001085',
      currentRceptNo: '20260310002820',
    })
    expect(csv).toContain('기초자본 · 이익잉여금')
  })
})
