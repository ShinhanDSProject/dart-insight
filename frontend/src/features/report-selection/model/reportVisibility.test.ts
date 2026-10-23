import { describe, expect, it } from 'vitest'
import type { ReportItem } from '@/shared/api/reports'
import { visibleReports } from './reportVisibility'

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

const items = [
  report('r2025', 2025),
  report('r2024', 2024),
  report('r2023', 2023),
  report('r2022', 2022),
  report('r2014', 2014),
]
const numbers = (rows: ReportItem[]) => rows.map((r) => r.rceptNo)

describe('visibleReports', () => {
  it('접혀 있으면 가장 최근 보고서의 사업연도부터 3년치만 보이고 나머지 수를 센다', () => {
    const visible = visibleReports(items, [], false)
    expect(numbers(visible.rows)).toEqual(['r2025', 'r2024', 'r2023'])
    expect(visible.hiddenCount).toBe(2)
  })

  it('펼치면 모든 보고서가 원래 순서대로 보이고 숨는 수는 그대로 둔다', () => {
    const visible = visibleReports(items, [], true)
    expect(numbers(visible.rows)).toEqual(numbers(items))
    expect(visible.hiddenCount).toBe(2)
  })

  it('고른 현재·비교 보고서는 접힌 범위에 있어도 보인다', () => {
    const visible = visibleReports(items, ['r2025', 'r2014'], false)
    expect(numbers(visible.rows)).toEqual(['r2025', 'r2024', 'r2023', 'r2014'])
    expect(visible.hiddenCount).toBe(1)
  })

  it('3년 안의 보고서만 있으면 숨는 보고서가 없다', () => {
    expect(visibleReports(items.slice(0, 3), [null], false).hiddenCount).toBe(0)
  })

  it('보고서가 없으면 빈 목록이다', () => {
    expect(visibleReports([], [], false)).toEqual({ rows: [], hiddenCount: 0 })
  })
})
