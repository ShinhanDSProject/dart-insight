import { describe, expect, it } from 'vitest'
import { checkHeader, checkStatusLabel, checkStatusTone, resultSummary, statementBasisLabel } from './comparabilityLabels'

describe('comparabilityLabels', () => {
  it('검증 상태 문구', () => {
    expect(checkStatusLabel('OK')).toBe('확인됨')
    expect(checkStatusLabel('WARN')).toBe('주의')
    expect(checkStatusLabel('FAIL')).toBe('비교 불가')
    expect(checkStatusLabel('SKIPPED')).toBe('확인 안 함')
  })

  it('재무제표별 금액 기준', () => {
    expect(statementBasisLabel({ sjDiv: 'IS', label: '손익계산서', comparable: true, amountBasis: 'QUARTER', note: null })).toBe(
      '3개월 금액',
    )
    expect(
      statementBasisLabel({ sjDiv: 'CF', label: '현금흐름표', comparable: false, amountBasis: null, note: '기간이 달라요' }),
    ).toBe('비교 안 함')
  })

  it('결과 요약은 비교 불가와 일부 비교를 구분한다', () => {
    expect(resultSummary({ comparable: false, level: 'NOT_COMPARABLE', fsDiv: null })).toBe(
      '이 두 보고서는 비교할 수 없어요.',
    )
    expect(resultSummary({ comparable: true, level: 'PARTIAL', fsDiv: 'CFS' })).toContain('일부 재무제표만')
    expect(resultSummary({ comparable: true, level: 'FULL', fsDiv: 'OFS' })).toContain('별도 재무제표')
  })

  it('조건 표 배지는 확인됨·확인 안 함을 회색, 주의를 노랑, 비교 불가를 분홍으로 둔다', () => {
    expect(checkStatusTone('OK')).toBe('neutral')
    expect(checkStatusTone('SKIPPED')).toBe('neutral')
    expect(checkStatusTone('WARN')).toBe('attention')
    expect(checkStatusTone('FAIL')).toBe('danger')
  })

  it('화면 머리는 결과에 따라 분석 준비·비교 불가 배지를 달고, 결과가 없으면 배지가 없다', () => {
    expect(checkHeader(null)).toEqual({ title: '비교 대상을 확인하세요', badge: null })
    expect(checkHeader({ comparable: true }).badge).toEqual({ tone: 'accent', label: '분석 준비' })
    expect(checkHeader({ comparable: false })).toEqual({
      title: '이 두 보고서는 비교할 수 없어요',
      badge: { tone: 'danger', label: '비교 불가' },
    })
  })
})
