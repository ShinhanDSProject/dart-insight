import { describe, expect, it } from 'vitest'
import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import type { ReportItem } from '@/shared/api/reports'
import { collapsedList, REPORT_ROWS_INITIAL, visiblePastAnalyses, visibleReports } from './reportVisibility'

function report(rceptNo: string, fiscalYear: number): ReportItem {
  return {
    rceptNo,
    reportName: '사업보고서',
    reportType: 'ANNUAL',
    disclosureType: 'A001',
    fiscalYear,
    periodEnd: `${fiscalYear}-12-31`,
    receivedAt: `${fiscalYear + 1}-03-14`,
    correction: 'ORIGINAL',
    financialDataStatus: 'UNKNOWN',
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
  }
}

function analysis(analysisId: number): CompanyAnalysisItem {
  return {
    analysisId,
    basis: 'YOY',
    previous: { rceptNo: '20250814000987', reportName: '반기보고서 (2025.06)', periodEnd: '2025-06-30' },
    current: { rceptNo: '20260814001234', reportName: '반기보고서 (2026.06)', periodEnd: '2026-06-30' },
    completedAt: '2026-10-24T15:20:31',
  }
}

// 최근 보고서가 앞에 오는 12개(r2025 … r2014)
const items = Array.from({ length: 12 }, (_, i) => report(`r${2025 - i}`, 2025 - i))
const numbers = (rows: ReportItem[]) => rows.map((r) => r.rceptNo)

describe('collapsedList', () => {
  it('접혀 있으면 앞에서 정한 수만큼 보이고 나머지 수를 센다', () => {
    expect(collapsedList([1, 2, 3, 4, 5], 2, false)).toEqual({ rows: [1, 2], hiddenCount: 3 })
  })

  it('펼치면 모든 항목이 원래 순서대로 보이고 숨는 수는 그대로 둔다', () => {
    expect(collapsedList([1, 2, 3, 4, 5], 2, true)).toEqual({ rows: [1, 2, 3, 4, 5], hiddenCount: 3 })
  })

  it('남길 항목은 앞쪽 범위 밖이어도 원래 자리 순서대로 보이고 숨는 수에서 빠진다', () => {
    expect(collapsedList([1, 2, 3, 4, 5], 2, false, (n) => n === 4)).toEqual({ rows: [1, 2, 4], hiddenCount: 2 })
  })

  it('정한 수보다 적으면 숨는 항목이 없다', () => {
    expect(collapsedList([1, 2], 3, false)).toEqual({ rows: [1, 2], hiddenCount: 0 })
  })

  it('항목이 없으면 빈 목록이다', () => {
    expect(collapsedList([], 3, false)).toEqual({ rows: [], hiddenCount: 0 })
  })
})

describe('visibleReports', () => {
  it('접혀 있으면 최근 보고서 8개만 보이고 나머지 수를 센다', () => {
    const visible = visibleReports(items, [], false)
    expect(numbers(visible.rows)).toEqual(numbers(items.slice(0, REPORT_ROWS_INITIAL)))
    expect(visible.hiddenCount).toBe(4)
  })

  it('펼치면 모든 보고서가 원래 순서대로 보인다', () => {
    expect(numbers(visibleReports(items, [], true).rows)).toEqual(numbers(items))
  })

  it('고른 현재·비교 보고서는 접힌 범위에 있어도 보인다', () => {
    const visible = visibleReports(items, ['r2025', 'r2015'], false)
    expect(numbers(visible.rows)).toEqual([...numbers(items.slice(0, REPORT_ROWS_INITIAL)), 'r2015'])
    expect(visible.hiddenCount).toBe(3)
  })

  it('고르지 않은 값(null·undefined)은 무시한다', () => {
    expect(visibleReports(items, [null, undefined], false).hiddenCount).toBe(4)
  })

  it('8개 이하면 숨는 보고서가 없다', () => {
    expect(visibleReports(items.slice(0, REPORT_ROWS_INITIAL), [], false).hiddenCount).toBe(0)
  })
})

describe('visiblePastAnalyses', () => {
  it('접혀 있으면 최근 분석 3개만 보이고 나머지 수를 센다', () => {
    const visible = visiblePastAnalyses([15, 14, 13, 12, 11].map(analysis), false)
    expect(visible.rows.map((a) => a.analysisId)).toEqual([15, 14, 13])
    expect(visible.hiddenCount).toBe(2)
  })

  it('펼치면 모든 분석이 보인다', () => {
    expect(visiblePastAnalyses([15, 14, 13, 12].map(analysis), true).rows).toHaveLength(4)
  })
})
