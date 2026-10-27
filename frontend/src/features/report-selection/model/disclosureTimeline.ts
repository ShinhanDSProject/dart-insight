import type { DisclosureGroup, DisclosureGroupCount, DisclosureItem } from '@/shared/api/disclosures'

/** 처음에 보여 주는 공시 수. '더 보기'를 누르면 이만큼 더 보여 준다 */
export const TIMELINE_PAGE_SIZE = 10

/** 공시 타임라인 화면 상태. 묶음을 바꾸면 보여 주는 수를 처음으로 되돌린다(둘이 함께 바뀜, ST-2) */
export interface TimelineState {
  /** null이면 모든 묶음 */
  group: DisclosureGroup | null
  limit: number
}

export type TimelineAction = { type: 'select-group'; group: DisclosureGroup | null } | { type: 'show-more' }

export const INITIAL_TIMELINE: TimelineState = { group: null, limit: TIMELINE_PAGE_SIZE }

export function timelineReducer(state: TimelineState, action: TimelineAction): TimelineState {
  switch (action.type) {
    case 'select-group':
      return action.group === state.group ? state : { group: action.group, limit: TIMELINE_PAGE_SIZE }
    case 'show-more':
      return { ...state, limit: state.limit + TIMELINE_PAGE_SIZE }
  }
}

export interface GroupChip {
  group: DisclosureGroup | null
  label: string
  count: number
}

/** 거르기 칩: '전체'와 서버가 준 묶음(서버 순서 그대로) */
export function groupChips(groups: DisclosureGroupCount[]): GroupChip[] {
  const total = groups.reduce((sum, g) => sum + g.count, 0)
  return [{ group: null, label: '전체', count: total }, ...groups.map((g) => ({ ...g }))]
}

export interface DateGroup {
  /** 접수일(YYYY-MM-DD) */
  date: string
  items: DisclosureItem[]
}

export interface TimelineView {
  days: DateGroup[]
  /** 거른 공시 수 */
  total: number
  /** 아직 보여 주지 않은 공시 수 */
  remaining: number
}

/**
 * 거른 공시를 접수일별로 묶는다. 서버가 준 순서(접수일이 최근인 순서)를 지키고, 앞에서 limit건만 넣는다.
 */
export function timelineView(items: DisclosureItem[], state: TimelineState): TimelineView {
  const filtered = state.group === null ? items : items.filter((item) => item.group === state.group)
  const shown = filtered.slice(0, state.limit)
  const days: DateGroup[] = []
  for (const item of shown) {
    const last = days.at(-1)
    if (last?.date === item.receivedDate) {
      last.items.push(item)
    } else {
      days.push({ date: item.receivedDate, items: [item] })
    }
  }
  return { days, total: filtered.length, remaining: filtered.length - shown.length }
}

/**
 * '이 보고서로 비교하기' 주소. 기업 화면(보고서 비교)은 ?current=접수번호로 현재 보고서를 고른다.
 */
export function compareWithReportPath(corpCode: string, rceptNo: string): string {
  return `/companies/${encodeURIComponent(corpCode)}?${new URLSearchParams({ current: rceptNo }).toString()}`
}
