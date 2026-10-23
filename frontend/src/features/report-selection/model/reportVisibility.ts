import type { ReportItem } from '@/shared/api/reports'

/** 처음에 보이는 사업연도 수(가장 최근 보고서의 사업연도부터) */
export const RECENT_YEARS = 3

export interface VisibleReports {
  /** 표에 보이는 보고서(원래 순서 그대로) */
  rows: ReportItem[]
  /** 접었을 때 숨는 보고서 수. 0이면 펼치기·접기 버튼을 두지 않는다 */
  hiddenCount: number
}

/**
 * 보고서 표에 보일 행. 처음에는 최근 3개 사업연도만 보이고, 펼치면 모두 보인다.
 * 고른 보고서(keep: 현재·비교 접수번호)는 접힌 범위에 있어도 보인다.
 */
export function visibleReports(
  items: ReportItem[],
  keep: ReadonlyArray<string | null | undefined>,
  expanded: boolean,
): VisibleReports {
  if (items.length === 0) return { rows: [], hiddenCount: 0 }
  const newestYear = Math.max(...items.map((r) => r.fiscalYear))
  const shown = items.filter((r) => r.fiscalYear > newestYear - RECENT_YEARS || keep.includes(r.rceptNo))
  const hiddenCount = items.length - shown.length
  return { rows: expanded ? items : shown, hiddenCount }
}
