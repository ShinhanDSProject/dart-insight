/**
 * 첫 화면 목록을 처음엔 몇 개만 보이고 '더 보기'로 펼치는 규칙(#374). 숨길 것이 없으면 버튼도 없다.
 */
export interface CollapsedList<T> {
  shown: readonly T[]
  /** 접혀 있어 보이지 않는 수. 펼쳤거나 숨길 것이 없으면 0 */
  hiddenCount: number
  /** '더 보기'·'접기' 버튼을 둘지 */
  toggleable: boolean
}

export function collapseList<T>(items: readonly T[], initialCount: number, expanded: boolean): CollapsedList<T> {
  const toggleable = items.length > initialCount
  if (!toggleable || expanded) return { shown: items, hiddenCount: 0, toggleable }
  return { shown: items.slice(0, initialCount), hiddenCount: items.length - initialCount, toggleable }
}
