import type { CompanyAnalysisItem } from '@/shared/api/analyses'
import type { ReportItem } from '@/shared/api/reports'

/** 보고서 표에서 처음 보이는 행 수(가장 최근 보고서부터) */
export const REPORT_ROWS_INITIAL = 8

/** '이미 분석한 비교'에서 처음 보이는 분석 수(가장 최근 것부터) */
export const PAST_ANALYSES_INITIAL = 3

export interface CollapsedList<T> {
  /** 보이는 항목(원래 순서 그대로) */
  rows: T[]
  /** 접었을 때 숨는 항목 수. 0이면 '더 보기'·'접기' 버튼을 두지 않는다 */
  hiddenCount: number
}

/**
 * 접을 수 있는 목록에 보일 항목. 접혀 있으면 앞에서 initial개와 keep에 맞는 항목만 보이고, 펼치면 모두 보인다.
 * keep에 맞는 항목은 앞쪽 범위 밖에 있어도 원래 자리 순서대로 보인다(숨는 수에서 빠진다).
 */
export function collapsedList<T>(
  items: readonly T[],
  initial: number,
  expanded: boolean,
  keep: (item: T) => boolean = () => false,
): CollapsedList<T> {
  const shown = items.filter((item, index) => index < initial || keep(item))
  const hiddenCount = items.length - shown.length
  return { rows: expanded ? [...items] : shown, hiddenCount }
}

/**
 * 보고서 표에 보일 행. 처음에는 최근 8개만 보이고, 펼치면 모두 보인다.
 * 고른 보고서(keep: 현재·비교 접수번호)는 접힌 범위에 있어도 보인다. 목록은 최근 보고서가 앞에 온다.
 */
export function visibleReports(
  items: ReportItem[],
  keep: ReadonlyArray<string | null | undefined>,
  expanded: boolean,
): CollapsedList<ReportItem> {
  return collapsedList(items, REPORT_ROWS_INITIAL, expanded, (r) => keep.includes(r.rceptNo))
}

/** '이미 분석한 비교'에 보일 분석. 처음에는 최근 3개만 보이고, 펼치면 모두 보인다 */
export function visiblePastAnalyses(items: CompanyAnalysisItem[], expanded: boolean): CollapsedList<CompanyAnalysisItem> {
  return collapsedList(items, PAST_ANALYSES_INITIAL, expanded)
}
