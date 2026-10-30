import { describe, expect, it } from 'vitest'
import type { FinancialChangeItem, ScaleBase, SjDiv } from '@/shared/api/results'
import { keyNumbers, normalizeAccountName } from './keyNumbers'

let nextId = 1

function item(
  sjDiv: SjDiv,
  accountName: string,
  scale: { base: ScaleBase; baseAccountName: string | null } = { base: 'REVENUE', baseAccountName: null },
): FinancialChangeItem {
  return {
    changeId: nextId++,
    sjDiv,
    accountName,
    accountDetail: null,
    amountBasis: null,
    previousAmount: 100,
    currentAmount: 150,
    changeAmount: 50,
    changeRate: 0.5,
    direction: 'UP',
    calcStatus: 'OK',
    calcMessage: null,
    currency: 'KRW',
    scale: { ...scale, baseAmount: null, ratio: null, reason: null },
  }
}

const names = (statements: Parameters<typeof keyNumbers>[0]) =>
  keyNumbers(statements).map((k) => [k.key, k.label, k.item?.accountName ?? null])

describe('계정명 맞추기', () => {
  it('공백과 끝의 (손실)을 뺀다', () => {
    expect(normalizeAccountName('영업이익(손실)')).toBe('영업이익')
    expect(normalizeAccountName('영업활동 현금흐름')).toBe('영업활동현금흐름')
  })
})

describe('핵심 숫자', () => {
  it('재무상태표·손익계산서·현금흐름표에서 다섯 계정을 화면 순서로 찾는다', () => {
    const result = names({
      BS: [item('BS', '유동자산'), item('BS', '자산총계')],
      IS: [item('IS', '매출액'), item('IS', '영업이익(손실)'), item('IS', '반기순이익(손실)')],
      CF: [item('CF', '영업활동으로 인한 현금흐름'), item('CF', '투자활동현금흐름')],
    })
    expect(result).toEqual([
      ['REVENUE', '매출액', '매출액'],
      ['OPERATING_INCOME', '영업이익', '영업이익(손실)'],
      ['NET_INCOME', '반기순이익', '반기순이익(손실)'],
      ['TOTAL_ASSETS', '자산총계', '자산총계'],
      ['OPERATING_CASH_FLOW', '영업활동으로 인한 현금흐름', '영업활동으로 인한 현금흐름'],
    ])
  })

  it('매출액은 서버가 크기 맥락 기준으로 찾은 계정 이름을 먼저 쓴다', () => {
    const revenue = item('IS', '수익(매출액)', { base: 'REVENUE', baseAccountName: '수익(매출액)' })
    const result = keyNumbers({ IS: [item('IS', '매출원가', { base: 'REVENUE', baseAccountName: '수익(매출액)' }), revenue] })
    expect(result[0].item).toBe(revenue)
    expect(result[0].label).toBe('수익(매출액)')
  })

  it('손익계산서가 없으면 포괄손익계산서에서 찾는다', () => {
    const operating = item('CIS', '영업이익')
    expect(keyNumbers({ IS: [], CIS: [operating] })[1].item).toBe(operating)
  })

  it('찾지 못한 칸은 기본 이름과 null로 둔다(0으로 채우지 않음)', () => {
    expect(names({})).toEqual([
      ['REVENUE', '매출액', null],
      ['OPERATING_INCOME', '영업이익', null],
      ['NET_INCOME', '순이익', null],
      ['TOTAL_ASSETS', '자산총계', null],
      ['OPERATING_CASH_FLOW', '영업활동현금흐름', null],
    ])
  })

  it('자본 구성요소가 붙은 계정(자본변동표 상세)은 고르지 않는다', () => {
    const detailed = { ...item('BS', '자산총계'), accountDetail: '이익잉여금' }
    expect(keyNumbers({ BS: [detailed] })[3].item).toBeNull()
  })
})
