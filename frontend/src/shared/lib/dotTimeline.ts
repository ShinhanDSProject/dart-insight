/**
 * 점 타임라인(DotTimeline)의 위치 계산. 날짜 → 가로 위치(%), 줄 이름 → 줄 번호, 월 눈금, 겹침 피하기, 키보드 이동.
 * 화면 크기를 모르는 순수 함수라 가로 위치는 0~100(%)으로 돌려준다.
 */

const DAY_MS = 86_400_000

/** YYYY-MM-DD → 1970-01-01부터 센 날 수(UTC로 읽어 시간대에 따라 하루씩 밀리지 않는다) */
export function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split('-').map(Number)
  return Math.round(Date.UTC(y, m - 1, d) / DAY_MS)
}

/** 날짜의 가로 위치(%). from이 0, to가 100이고 기간 밖은 끝에 붙인다. 기간이 하루뿐이면 가운데 */
export function timeX(date: string, from: string, to: string): number {
  const start = dayNumber(from)
  const span = dayNumber(to) - start
  if (span <= 0) return 50
  const ratio = (dayNumber(date) - start) / span
  return Math.min(100, Math.max(0, ratio * 100))
}

export interface MonthTick {
  /** 그달 1일(YYYY-MM-01) */
  date: string
  x: number
  /** 예: '3월' */
  label: string
  /** 1월이거나 첫 눈금이면 '2026년'처럼 연도를 붙인다 */
  yearLabel: string | null
  /** 1·4·7·10월. 좁은 화면에서는 이 눈금의 글자만 남긴다 */
  major: boolean
}

/** from~to 안에 드는 매달 1일 눈금(오래된 순서) */
export function monthTicks(from: string, to: string): MonthTick[] {
  const [fy, fm, fd] = from.split('-').map(Number)
  let year = fy
  let month = fd === 1 ? fm : fm + 1
  if (month > 12) {
    month = 1
    year += 1
  }
  const end = dayNumber(to)
  const ticks: MonthTick[] = []
  for (;;) {
    const date = `${year}-${String(month).padStart(2, '0')}-01`
    if (dayNumber(date) > end) break
    ticks.push({
      date,
      x: timeX(date, from, to),
      label: `${month}월`,
      yearLabel: month === 1 || ticks.length === 0 ? `${year}년` : null,
      major: month % 3 === 1,
    })
    month += 1
    if (month > 12) {
      month = 1
      year += 1
    }
  }
  return ticks
}

/** 줄 이름 → 위에서부터 센 줄 번호. 없는 줄이면 -1 */
export function rowIndex(rows: readonly { key: string }[], key: string): number {
  return rows.findIndex((row) => row.key === key)
}

/** 한 줄 안에서 점을 놓는 자리. 0은 가운데, -1은 위, 1은 아래 */
export type Lane = -1 | 0 | 1

const LANE_ORDER: readonly Lane[] = [0, -1, 1]

export interface TimelineInputPoint {
  id: string
  row: string
  date: string
}

export interface PlacedPoint<P extends TimelineInputPoint> {
  point: P
  x: number
  rowIndex: number
  lane: Lane
}

export interface TimelineLayout<P extends TimelineInputPoint> {
  ticks: MonthTick[]
  /** 오래된 순서(같은 날이면 위 줄 먼저). 좌우 화살표가 이 순서로 옮긴다 */
  placed: PlacedPoint<P>[]
}

/** 같은 줄에서 이 날 수보다 가까운 점은 위·아래 자리로 비켜 놓는다(세 자리를 다 쓰면 겹치고 바탕색 테두리로 구분) */
export const LANE_GAP_DAYS = 4

/**
 * 점마다 가로 위치·줄 번호·자리를 정한다. 없는 줄의 점은 뺀다.
 * 자리: 같은 줄에서 앞 점과 LANE_GAP_DAYS일 안이면 가운데 → 위 → 아래 중 비어 있는 첫 자리. 다 차 있으면 가장 오래전에 쓴 자리.
 */
export function layoutTimeline<P extends TimelineInputPoint>(
  rows: readonly { key: string }[],
  points: readonly P[],
  from: string,
  to: string,
): TimelineLayout<P> {
  const withRow = points
    .map((point) => ({ point, rowIndex: rowIndex(rows, point.row), day: dayNumber(point.date) }))
    .filter((p) => p.rowIndex >= 0)
    .sort((a, b) => a.day - b.day || a.rowIndex - b.rowIndex)

  // 줄마다 자리별 마지막 점의 날
  const lastDay = new Map<number, Map<Lane, number>>()
  const placed = withRow.map(({ point, rowIndex: index, day }) => {
    const lanes = lastDay.get(index) ?? new Map<Lane, number>()
    lastDay.set(index, lanes)
    const free = LANE_ORDER.find((lane) => {
      const last = lanes.get(lane)
      return last === undefined || day - last >= LANE_GAP_DAYS
    })
    const lane =
      free ?? LANE_ORDER.reduce((oldest, lane) => ((lanes.get(lane) ?? 0) < (lanes.get(oldest) ?? 0) ? lane : oldest))
    lanes.set(lane, day)
    return { point, x: timeX(point.date, from, to), rowIndex: index, lane }
  })
  return { ticks: monthTicks(from, to), placed }
}

export type TimelineKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'

/**
 * 키보드로 옮길 점. 좌우는 시간 순서로 하나씩, 위아래는 점이 있는 이웃 줄에서 가로로 가장 가까운 점, Home·End는 처음·끝.
 * 옮길 곳이 없으면 지금 점을 그대로 돌려준다. 점이 없으면 null.
 */
export function nextPointId<P extends TimelineInputPoint>(
  placed: readonly PlacedPoint<P>[],
  currentId: string | null,
  key: TimelineKey,
): string | null {
  if (placed.length === 0) return null
  const index = Math.max(
    0,
    placed.findIndex((p) => p.point.id === currentId),
  )
  const current = placed[index]
  switch (key) {
    case 'Home':
      return placed[0].point.id
    case 'End':
      return placed[placed.length - 1].point.id
    case 'ArrowLeft':
      return placed[Math.max(0, index - 1)].point.id
    case 'ArrowRight':
      return placed[Math.min(placed.length - 1, index + 1)].point.id
    case 'ArrowUp':
    case 'ArrowDown': {
      const step = key === 'ArrowUp' ? -1 : 1
      const rowIndexes = [...new Set(placed.map((p) => p.rowIndex))].sort((a, b) => a - b)
      const target = rowIndexes[rowIndexes.indexOf(current.rowIndex) + step]
      if (target === undefined) return current.point.id
      const candidates = placed.filter((p) => p.rowIndex === target)
      const nearest = candidates.reduce((best, p) => (Math.abs(p.x - current.x) < Math.abs(best.x - current.x) ? p : best))
      return nearest.point.id
    }
  }
}

/** 툴팁을 점의 어느 쪽에 붙일지. 왼쪽·오른쪽 끝에 가까우면 차트 밖으로 나가지 않게 한쪽으로 붙인다 */
export function tooltipAlign(x: number): 'start' | 'center' | 'end' {
  if (x < 25) return 'start'
  if (x > 75) return 'end'
  return 'center'
}

/** 툴팁 상태. 어떤 점을 가리키는지와 보이는지가 함께 바뀐다(ST-2) */
export interface DotTimelineState {
  /** 키보드로 들어올 점(로빙 tabindex). null이면 가장 최근 점 */
  activeId: string | null
  open: boolean
}

export type DotTimelineAction = { type: 'show'; id: string } | { type: 'hide' }

export const INITIAL_DOT_TIMELINE: DotTimelineState = { activeId: null, open: false }

export function dotTimelineReducer(state: DotTimelineState, action: DotTimelineAction): DotTimelineState {
  switch (action.type) {
    case 'show':
      return state.open && state.activeId === action.id ? state : { activeId: action.id, open: true }
    case 'hide':
      return state.open ? { ...state, open: false } : state
  }
}
