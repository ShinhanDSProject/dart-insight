import { describe, expect, it } from 'vitest'
import { correctionLabel, dataStatusLabel, formatDate, formatDateRange, periodLabel, reportTypeLabel } from './reportLabels'

describe('reportLabels', () => {
  it('대상 기간은 사업연도 시작부터 기간 끝까지 보여 준다', () => {
    expect(periodLabel({ reportType: 'HALF', fiscalYear: 2026, periodEnd: '2026-06-30' })).toBe(
      '2026 반기 (2026.01.01 ~ 2026.06.30)',
    )
    expect(periodLabel({ reportType: 'ANNUAL', fiscalYear: 2025, periodEnd: '2025-12-31' })).toBe(
      '2025 사업연도 (2025.01.01 ~ 2025.12.31)',
    )
  })

  it('보고서 종류 이름', () => {
    expect(reportTypeLabel('Q3')).toBe('3분기보고서')
    expect(reportTypeLabel('ANNUAL')).toBe('사업보고서')
  })

  it('제출일은 날짜만 보여 준다', () => {
    expect(formatDate('2026-08-14')).toBe('2026.08.14')
  })

  it('날짜 구간은 같은 해면 끝날 연도를 줄이고, 같은 날이면 하루만 쓴다', () => {
    expect(formatDateRange('2026-03-10', '2026-03-13')).toBe('2026.03.10 ~ 03.13')
    expect(formatDateRange('2025-12-30', '2026-01-02')).toBe('2025.12.30 ~ 2026.01.02')
    expect(formatDateRange('2026-03-10', '2026-03-10')).toBe('2026.03.10')
  })

  it('정정 여부를 모르면 추정하지 않는다', () => {
    expect(correctionLabel('ORIGINAL')).toBe('정정 없음')
    expect(correctionLabel('CORRECTED')).toBe('정정 있음 · 최종본')
    expect(correctionLabel('UNKNOWN')).toBe('확인 안 됨')
  })

  it('재무 자료 상태를 구분한다', () => {
    expect(dataStatusLabel('UNKNOWN')).toBe('받기 전')
    expect(dataStatusLabel('AVAILABLE')).toBe('준비됨')
    expect(dataStatusLabel('NOT_AVAILABLE')).toBe('재무 자료 없음')
  })
})
