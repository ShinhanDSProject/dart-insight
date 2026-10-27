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

/** 한 줄에서 비켜 놓을 수 있는 자리 수. 화면에서 붙은 점이 이보다 많으면 모음 점 하나로 그린다 */
export const LANE_COUNT = LANE_ORDER.length

export interface TimelineInputPoint {
  id: string
  row: string
  date: string
  /** 정기보고서처럼 따로 보여야 하는 점. 모음에 넣지 않고 늘 하나씩 그린다 */
  emphasis?: boolean
}

/** 하나씩 그리는 점 */
export interface PlacedPoint<P extends TimelineInputPoint> {
  kind: 'point'
  id: string
  point: P
  x: number
  rowIndex: number
  lane: Lane
}

/** 모음 점의 크기 단계(1 작게 ~ 3 크게). 건수가 많을수록 크다 */
export type ClusterSize = 1 | 2 | 3

/** 같은 줄에서 화면상 붙은 점 여러 개를 하나로 그린 모음 점 */
export interface PlacedCluster<P extends TimelineInputPoint> {
  kind: 'cluster'
  id: string
  /** 오래된 순서 */
  points: P[]
  x: number
  rowIndex: number
  /** 묶인 점의 처음·마지막 날(YYYY-MM-DD) */
  from: string
  to: string
  size: ClusterSize
}

export type PlacedItem<P extends TimelineInputPoint> = PlacedPoint<P> | PlacedCluster<P>

export interface TimelineLayout<P extends TimelineInputPoint> {
  ticks: MonthTick[]
  /** 가로 위치 순서(같으면 위 줄 먼저). 좌우 화살표가 이 순서로 옮긴다. 모음 점은 하나로 센다 */
  items: PlacedItem<P>[]
}

/** 같은 줄에서 이 날 수보다 가까운 점은 위·아래 자리로 비켜 놓는다(세 자리를 다 쓰면 겹치고 바탕색 테두리로 구분) */
export const LANE_GAP_DAYS = 4

/**
 * 모으는 칸의 폭(px). 줄마다 점을 놓는 칸을 이 폭으로 나눠, 한 칸에 LANE_COUNT보다 많은 점이 들면 모음 점 하나로 그린다.
 * 가장 큰 모음 점(지름 28px + 바탕 테두리 2px씩)이 들어가는 폭이라 이웃 칸의 모음 점끼리 겹치지 않는다(ui.css와 맞춘다).
 */
export const CLUSTER_BIN_PX = 32

/** 폭을 아직 재지 못했을 때(첫 그리기·테스트 환경) 쓰는 점 칸 폭(px) */
export const DEFAULT_PLOT_WIDTH = 720

/** 모음 점 크기 단계별 반지름 + 바탕 테두리(px). ui.css의 .dot-timeline__cluster--size-N 지름과 맞춘다 */
const CLUSTER_RADIUS_PX: Record<ClusterSize, number> = { 1: 10, 2: 12, 3: 16 }

/** 건수 → 모음 점 크기 단계. 4~9건 1, 10~99건 2, 100건 이상 3(상한) */
export function clusterSize(count: number): ClusterSize {
  if (count >= 100) return 3
  if (count >= 10) return 2
  return 1
}

/** 모음 점 안에 쓰는 건수. 네 자리부터는 '999+'로 줄여 원 안에 들어가게 한다(정확한 건수는 툴팁·이름에) */
export function clusterCountLabel(count: number): string {
  return count > 999 ? '999+' : String(count)
}

/**
 * 점마다 가로 위치·줄 번호를 정하고, 화면에서 붙은 점이 많으면 모음 점으로 묶는다. 없는 줄의 점은 뺀다.
 * - 모으기: 줄마다 점 칸 폭(widthPx)을 CLUSTER_BIN_PX 칸으로 나눠, 한 칸에 emphasis가 아닌 점이 LANE_COUNT보다 많으면
 *   모음 점 하나로 그린다. 모음 점은 묶인 점의 가운데 위치에 두되 칸 밖으로 나가지 않게 당긴다. 폭이 바뀌면 다시 묶는다.
 * - 자리: 하나씩 그리는 점은 같은 줄에서 앞 점과 LANE_GAP_DAYS일 안이면 가운데 → 위 → 아래 중 비어 있는 첫 자리.
 *   다 차 있으면 가장 오래전에 쓴 자리.
 */
export function layoutTimeline<P extends TimelineInputPoint>(
  rows: readonly { key: string }[],
  points: readonly P[],
  from: string,
  to: string,
  widthPx: number = DEFAULT_PLOT_WIDTH,
): TimelineLayout<P> {
  const width = widthPx > 0 ? widthPx : DEFAULT_PLOT_WIDTH
  const binCount = Math.max(1, Math.ceil(width / CLUSTER_BIN_PX))
  const withRow = points
    .map((point) => ({ point, rowIndex: rowIndex(rows, point.row), day: dayNumber(point.date), x: timeX(point.date, from, to) }))
    .filter((p) => p.rowIndex >= 0)
    .sort((a, b) => a.day - b.day || a.rowIndex - b.rowIndex)

  // 줄·칸마다 모을 수 있는 점(emphasis 빼고)
  const bins = new Map<string, { rowIndex: number; bin: number; members: typeof withRow }>()
  for (const p of withRow) {
    if (p.point.emphasis) continue
    const bin = Math.min(binCount - 1, Math.floor(((p.x / 100) * width) / CLUSTER_BIN_PX))
    const key = `${p.rowIndex}:${bin}`
    const entry = bins.get(key) ?? { rowIndex: p.rowIndex, bin, members: [] }
    entry.members.push(p)
    bins.set(key, entry)
  }

  const clustered = new Set<P>()
  const clusters: PlacedCluster<P>[] = []
  for (const { rowIndex: index, bin, members } of bins.values()) {
    if (members.length <= LANE_COUNT) continue
    const size = clusterSize(members.length)
    const radius = CLUSTER_RADIUS_PX[size]
    const meanPx = members.reduce((sum, m) => sum + (m.x / 100) * width, 0) / members.length
    const lo = bin * CLUSTER_BIN_PX + radius
    const hi = (bin + 1) * CLUSTER_BIN_PX - radius
    const px = Math.min(width, Math.max(0, Math.min(hi, Math.max(lo, meanPx))))
    members.forEach((m) => clustered.add(m.point))
    clusters.push({
      kind: 'cluster',
      id: `cluster:${index}:${bin}`,
      points: members.map((m) => m.point),
      x: (px / width) * 100,
      rowIndex: index,
      from: members[0].point.date,
      to: members[members.length - 1].point.date,
      size,
    })
  }

  // 줄마다 자리별 마지막 점의 날
  const lastDay = new Map<number, Map<Lane, number>>()
  const singles = withRow
    .filter((p) => !clustered.has(p.point))
    .map(({ point, rowIndex: index, day, x }): PlacedPoint<P> => {
      const lanes = lastDay.get(index) ?? new Map<Lane, number>()
      lastDay.set(index, lanes)
      const free = LANE_ORDER.find((lane) => {
        const last = lanes.get(lane)
        return last === undefined || day - last >= LANE_GAP_DAYS
      })
      const lane =
        free ?? LANE_ORDER.reduce((oldest, lane) => ((lanes.get(lane) ?? 0) < (lanes.get(oldest) ?? 0) ? lane : oldest))
      lanes.set(lane, day)
      return { kind: 'point', id: point.id, point, x, rowIndex: index, lane }
    })

  const items: PlacedItem<P>[] = [...singles, ...clusters].sort((a, b) => a.x - b.x || a.rowIndex - b.rowIndex)
  return { ticks: monthTicks(from, to), items }
}

/** 모음 점 툴팁에 보이는 공시 제목 수 */
export const CLUSTER_PREVIEW_LIMIT = 5

/** 모음 점 툴팁에 보일 점(최근 순서로 limit개)과 나머지 건수 */
export function clusterPreview<P extends TimelineInputPoint>(
  cluster: Pick<PlacedCluster<P>, 'points'>,
  limit: number = CLUSTER_PREVIEW_LIMIT,
): { shown: P[]; rest: number } {
  const shown = cluster.points.slice(-limit).reverse()
  return { shown, rest: cluster.points.length - shown.length }
}

export type TimelineKey = 'ArrowLeft' | 'ArrowRight' | 'ArrowUp' | 'ArrowDown' | 'Home' | 'End'

/** 키보드로 옮겨 다니는 대상(점 하나 또는 모음 점 하나) */
export interface TimelineTarget {
  id: string
  x: number
  rowIndex: number
}

/**
 * 키보드로 옮길 대상. 좌우는 가로 순서로 하나씩, 위아래는 대상이 있는 이웃 줄에서 가로로 가장 가까운 것, Home·End는 처음·끝.
 * 모음 점은 대상 하나다. 옮길 곳이 없으면 지금 대상을 그대로 돌려준다. 대상이 없으면 null.
 */
export function nextItemId(items: readonly TimelineTarget[], currentId: string | null, key: TimelineKey): string | null {
  if (items.length === 0) return null
  const index = Math.max(
    0,
    items.findIndex((p) => p.id === currentId),
  )
  const current = items[index]
  switch (key) {
    case 'Home':
      return items[0].id
    case 'End':
      return items[items.length - 1].id
    case 'ArrowLeft':
      return items[Math.max(0, index - 1)].id
    case 'ArrowRight':
      return items[Math.min(items.length - 1, index + 1)].id
    case 'ArrowUp':
    case 'ArrowDown': {
      const step = key === 'ArrowUp' ? -1 : 1
      const rowIndexes = [...new Set(items.map((p) => p.rowIndex))].sort((a, b) => a - b)
      const target = rowIndexes[rowIndexes.indexOf(current.rowIndex) + step]
      if (target === undefined) return current.id
      const candidates = items.filter((p) => p.rowIndex === target)
      const nearest = candidates.reduce((best, p) => (Math.abs(p.x - current.x) < Math.abs(best.x - current.x) ? p : best))
      return nearest.id
    }
  }
}

/** 툴팁을 점의 어느 쪽에 붙일지. 왼쪽·오른쪽 끝에 가까우면 차트 밖으로 나가지 않게 한쪽으로 붙인다 */
export function tooltipAlign(x: number): 'start' | 'center' | 'end' {
  if (x < 25) return 'start'
  if (x > 75) return 'end'
  return 'center'
}

/**
 * 툴팁 상태. 어떤 대상을 가리키는지·보이는지·고정했는지가 함께 바뀐다(ST-2).
 * hover·초점은 툴팁을 잠깐 보이고, 누르기(Enter·클릭)는 고정한다. 고정한 툴팁은 포인터가 떠나도 남고 Esc·바깥 누르기로 닫는다.
 */
export interface DotTimelineState {
  /** 키보드로 들어올 대상(로빙 tabindex). null이면 가장 최근 대상 */
  activeId: string | null
  open: boolean
  pinned: boolean
}

export type DotTimelineAction =
  | { type: 'hover'; id: string }
  | { type: 'focus'; id: string }
  | { type: 'toggle-pin'; id: string }
  | { type: 'leave' }
  | { type: 'close' }

export const INITIAL_DOT_TIMELINE: DotTimelineState = { activeId: null, open: false, pinned: false }

export function dotTimelineReducer(state: DotTimelineState, action: DotTimelineAction): DotTimelineState {
  switch (action.type) {
    case 'hover':
      // 고정한 툴팁은 다른 점 위를 지나가도 바꾸지 않는다(툴팁 안 링크로 포인터를 옮기는 길)
      if (state.pinned || (state.open && state.activeId === action.id)) return state
      return { activeId: action.id, open: true, pinned: false }
    case 'focus':
      if (state.open && state.activeId === action.id) return state
      return { activeId: action.id, open: true, pinned: false }
    case 'toggle-pin':
      if (state.pinned && state.activeId === action.id) return { ...state, open: false, pinned: false }
      return { activeId: action.id, open: true, pinned: true }
    case 'leave':
      return state.pinned || !state.open ? state : { ...state, open: false }
    case 'close':
      return state.open || state.pinned ? { ...state, open: false, pinned: false } : state
  }
}
