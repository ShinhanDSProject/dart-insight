import { describe, expect, it } from 'vitest'
import type { ReportItem } from '@/shared/api/reports'
import { customCandidates, reportOptionLabel } from './pairSelection'

function report(rceptNo: string, periodEnd: string, reportName = '반기보고서'): ReportItem {
  return {
    rceptNo,
    reportName,
    reportType: 'HALF',
    disclosureType: 'A002',
    fiscalYear: Number(periodEnd.slice(0, 4)),
    periodEnd,
    receivedAt: '2026-08-14',
    correction: 'ORIGINAL',
    financialDataStatus: 'UNKNOWN',
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

describe('pairSelection', () => {
  it('직접 선택은 현재 보고서보다 앞선 기간의 보고서만 고를 수 있다', () => {
    const items = [
      report('20260814000001', '2026-06-30'),
      report('20260515000001', '2026-03-31'),
      report('20250814000001', '2025-06-30'),
    ]
    expect(customCandidates(items, items[1]).map((r) => r.rceptNo)).toEqual(['20250814000001'])
    expect(customCandidates(items, items[0]).map((r) => r.rceptNo)).toEqual(['20260515000001', '20250814000001'])
    expect(customCandidates(items, null)).toEqual([])
  })

  it('고르는 목록에는 제출일을 함께 보여 준다', () => {
    expect(reportOptionLabel(report('20260814000001', '2026-06-30', '반기보고서 (2026.06)'))).toBe(
      '반기보고서 (2026.06) · 제출 2026.08.14',
    )
  })
})
