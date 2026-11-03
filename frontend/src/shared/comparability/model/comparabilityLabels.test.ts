import { describe, expect, it } from 'vitest'
import type { ComparabilityReason } from '@/shared/api/comparability'
import {
  checkBadgeLabel,
  checkHeader,
  checkStatusLabel,
  checkStatusTone,
  reasonTitle,
  resultSummary,
  statementBasisLabel,
} from './comparabilityLabels'

function reason(code: string): ComparabilityReason {
  return { code, message: '', nextAction: '' }
}

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
    expect(checkHeader({ comparable: true, reasons: [] }).badge).toEqual({ tone: 'accent', label: '분석 준비' })
    expect(checkHeader({ comparable: false, reasons: [] })).toEqual({
      title: '이 두 보고서는 비교할 수 없어요',
      badge: { tone: 'danger', label: '비교 불가' },
    })
  })

  it('비교할 수 없으면 첫 사유에 맞춘 제목을 쓰고 모르는 사유면 일반 제목을 쓴다', () => {
    expect(checkHeader({ comparable: false, reasons: [reason('SAME_REPORT'), reason('CURRENCY_MISMATCH')] }).title).toBe(
      '서로 다른 보고서를 선택해 주세요',
    )
    expect(checkHeader({ comparable: false, reasons: [reason('NEW_RULE')] }).title).toBe('이 두 보고서는 비교할 수 없어요')
    const codes = [
      'DIFFERENT_COMPANY',
      'SAME_REPORT',
      'PREVIOUS_NOT_EARLIER',
      'REPLACED_BY_CORRECTION',
      'NO_FINANCIAL_DATA',
      'DATA_VERSION_MISMATCH',
      'NO_COMMON_BASIS',
      'CURRENCY_MISMATCH',
    ]
    for (const code of codes) expect(reasonTitle(code)).toMatch(/요$/)
  })

  it('비교 불가 행은 그 행의 사유가 하나로 정해지면 짧은 사유 배지를 단다', () => {
    const reasons = [reason('SAME_REPORT')]
    expect(checkBadgeLabel({ item: 'REPORT_PERIOD', status: 'FAIL' }, reasons)).toBe('동일 보고서')
    expect(checkBadgeLabel({ item: 'COMPANY', status: 'OK' }, reasons)).toBe('확인됨')
    expect(checkBadgeLabel({ item: 'FINANCIAL_BASIS', status: 'SKIPPED' }, reasons)).toBe('확인 안 함')
    expect(checkBadgeLabel({ item: 'DATA_READY', status: 'FAIL' }, [reason('NO_FINANCIAL_DATA'), reason('NO_FINANCIAL_DATA')])).toBe(
      '재무제표 없음',
    )
    expect(checkBadgeLabel({ item: 'FINANCIAL_BASIS', status: 'FAIL' }, [reason('CURRENCY_MISMATCH')])).toBe('통화 다름')
  })

  it('행의 사유를 하나로 정할 수 없으면 일반 비교 불가 배지로 둔다', () => {
    // 자료가 없으면 수치 기준 행도 실패하지만 그 행에 붙는 사유는 정하지 않는다
    expect(checkBadgeLabel({ item: 'FINANCIAL_BASIS', status: 'FAIL' }, [reason('NO_COMMON_BASIS')])).toBe('비교 불가')
    expect(
      checkBadgeLabel({ item: 'DATA_READY', status: 'FAIL' }, [reason('NO_FINANCIAL_DATA'), reason('DATA_VERSION_MISMATCH')]),
    ).toBe('비교 불가')
    expect(checkBadgeLabel({ item: 'COMPANY', status: 'FAIL' }, [reason('NEW_RULE')])).toBe('비교 불가')
  })
})
