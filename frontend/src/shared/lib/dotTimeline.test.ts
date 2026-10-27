import { describe, expect, it } from 'vitest'
import {
  clusterCountLabel,
  clusterPreview,
  clusterSize,
  DEFAULT_PLOT_WIDTH,
  dayNumber,
  dotTimelineReducer,
  INITIAL_DOT_TIMELINE,
  layoutTimeline,
  monthTicks,
  nextItemId,
  rowIndex,
  timeX,
  tooltipAlign,
} from './dotTimeline'

const rows = [{ key: 'A' }, { key: 'B' }, { key: 'C' }]

describe('날짜 → 가로 위치', () => {
  it('시작일은 0, 끝날은 100, 가운데 날은 50이다', () => {
    expect(timeX('2026-01-01', '2026-01-01', '2026-01-11')).toBe(0)
    expect(timeX('2026-01-11', '2026-01-01', '2026-01-11')).toBe(100)
    expect(timeX('2026-01-06', '2026-01-01', '2026-01-11')).toBe(50)
  })

  it('기간 밖의 날은 양 끝에 붙이고, 기간이 하루면 가운데에 둔다', () => {
    expect(timeX('2025-12-01', '2026-01-01', '2026-01-11')).toBe(0)
    expect(timeX('2026-02-01', '2026-01-01', '2026-01-11')).toBe(100)
    expect(timeX('2026-01-01', '2026-01-01', '2026-01-01')).toBe(50)
  })

  it('날 수는 시간대와 관계없이 하루 간격으로 센다(윤년 포함)', () => {
    expect(dayNumber('2024-03-01') - dayNumber('2024-02-28')).toBe(2)
    expect(dayNumber('1970-01-02')).toBe(1)
  })
})

describe('월 눈금', () => {
  it('기간 안의 매달 1일에 눈금을 두고 첫 눈금과 1월에 연도를 붙인다', () => {
    const ticks = monthTicks('2025-10-27', '2026-10-26')
    expect(ticks.map((t) => t.date)).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
    ])
    expect(ticks[0]).toMatchObject({ label: '11월', yearLabel: '2025년', major: false })
    expect(ticks[2]).toMatchObject({ label: '1월', yearLabel: '2026년', major: true })
    expect(ticks[3].yearLabel).toBeNull()
    expect(ticks.filter((t) => t.major).map((t) => t.label)).toEqual(['1월', '4월', '7월', '10월'])
    expect(ticks.every((t, i) => i === 0 || t.x > ticks[i - 1].x)).toBe(true)
  })

  it('시작일이 1일이면 그날도 눈금이다', () => {
    expect(monthTicks('2026-01-01', '2026-02-15').map((t) => t.date)).toEqual(['2026-01-01', '2026-02-01'])
  })
})

describe('줄 번호와 점 놓기', () => {
  it('줄 이름으로 위에서부터 센 번호를 찾고 없으면 -1이다', () => {
    expect(rowIndex(rows, 'B')).toBe(1)
    expect(rowIndex(rows, 'Z')).toBe(-1)
  })

  it('점을 오래된 순서로 놓고, 같은 날은 위 줄 먼저, 없는 줄의 점은 뺀다', () => {
    const layout = layoutTimeline(
      rows,
      [
        { id: 'new', row: 'A', date: '2026-01-09' },
        { id: 'c', row: 'C', date: '2026-01-02' },
        { id: 'a', row: 'A', date: '2026-01-02' },
        { id: 'lost', row: 'Z', date: '2026-01-03' },
      ],
      '2026-01-01',
      '2026-01-11',
    )
    expect(layout.items.map((p) => [p.id, p.rowIndex, p.x])).toEqual([
      ['a', 0, 10],
      ['c', 2, 10],
      ['new', 0, 80],
    ])
  })

  it('같은 줄에서 가까운 날의 점은 가운데 → 위 → 아래 자리로 비키고, 다 차면 가장 오래전에 쓴 자리를 다시 쓴다', () => {
    // 아주 넓은 차트라 하루 차이도 다른 칸이 되어 모이지 않는다
    const layout = layoutTimeline(
      rows,
      ['p1', 'p2', 'p3']
        .map((id) => ({ id, row: 'A', date: '2026-03-01' }))
        .concat({ id: 'p4', row: 'A', date: '2026-03-02' }, { id: 'far', row: 'A', date: '2026-03-20' }),
      '2026-01-01',
      '2026-12-31',
      100_000,
    )
    expect(layout.items.map((p) => [p.id, p.kind === 'point' ? p.lane : null])).toEqual([
      ['p1', 0],
      ['p2', -1],
      ['p3', 1],
      ['p4', 0],
      ['far', 0],
    ])
  })
})

describe('모음 점', () => {
  const from = '2026-01-01'
  const to = '2026-12-31'
  const day = (n: number) => `2026-03-${String(n).padStart(2, '0')}`
  const crowd = (days: number[], extra: Partial<{ emphasis: boolean }> = {}) =>
    days.map((n, i) => ({ id: `a${i}`, row: 'A', date: day(n), ...extra }))

  it('한 칸(32px)에 점이 3개 이하면 하나씩 두고, 4개 이상이면 모음 점 하나로 묶는다', () => {
    expect(layoutTimeline(rows, crowd([10, 10, 10]), from, to, 720).items.map((p) => p.kind)).toEqual(['point', 'point', 'point'])

    const four = layoutTimeline(rows, crowd([10, 11, 12, 13]), from, to, 720)
    expect(four.items).toHaveLength(1)
    const [cluster] = four.items
    expect(cluster).toMatchObject({ kind: 'cluster', rowIndex: 0, from: '2026-03-10', to: '2026-03-13', size: 1 })
    if (cluster.kind !== 'cluster') throw new Error('모음 점이 아니다')
    expect(cluster.points.map((p) => p.id)).toEqual(['a0', 'a1', 'a2', 'a3'])
  })

  it('정기보고서(emphasis)는 모음에 넣지 않고 늘 하나씩 그린다', () => {
    const layout = layoutTimeline(rows, crowd([10, 10, 10, 10, 10], { emphasis: true }), from, to, 720)
    expect(layout.items.map((p) => p.kind)).toEqual(['point', 'point', 'point', 'point', 'point'])
  })

  it('다른 줄의 점은 따로 묶고, 묶이지 않은 점과 가로 순서로 섞어 둔다', () => {
    const layout = layoutTimeline(
      rows,
      [
        ...crowd([10, 10, 10, 10]),
        ...[1, 2, 3, 4, 5].map((n) => ({ id: `b${n}`, row: 'B', date: day(10) })),
        { id: 'early', row: 'C', date: '2026-02-01' },
      ],
      from,
      to,
      720,
    )
    expect(layout.items.map((p) => [p.kind, p.rowIndex])).toEqual([
      ['point', 2],
      ['cluster', 0],
      ['cluster', 1],
    ])
  })

  it('차트 폭이 넓어지면 칸이 날 수로 좁아져 덜 묶이고, 좁아지면 더 묶인다', () => {
    const spread = crowd([8, 12, 16, 20])
    expect(layoutTimeline(rows, spread, from, to, 720).items.map((p) => p.kind)).toEqual(['cluster'])
    expect(layoutTimeline(rows, spread, from, to, 3000).items.map((p) => p.kind)).toEqual(['point', 'point', 'point', 'point'])
  })

  it('모음 점은 묶인 점의 가운데에 두되 칸 밖으로 나가지 않는다', () => {
    const layout = layoutTimeline(rows, crowd([1, 1, 1, 1]).map((p) => ({ ...p, date: from })), from, to, 720)
    // 모두 0px에 있지만 반지름 + 테두리(10px)만큼 안으로 당긴다
    expect(layout.items[0].x).toBeCloseTo((10 / 720) * 100)
  })

  it('폭을 재지 못했으면(0) 기본 폭으로 묶는다', () => {
    const points = crowd([10, 10, 10, 10])
    expect(layoutTimeline(rows, points, from, to, 0)).toEqual(layoutTimeline(rows, points, from, to, DEFAULT_PLOT_WIDTH))
  })

  it('크기는 건수에 따라 세 단계이고 100건부터는 더 커지지 않는다', () => {
    expect([4, 9, 10, 99, 100, 5000].map(clusterSize)).toEqual([1, 1, 2, 2, 3, 3])
  })

  it('건수 글자는 세 자리까지 그대로, 네 자리부터 999+로 줄인다', () => {
    expect(clusterCountLabel(4)).toBe('4')
    expect(clusterCountLabel(999)).toBe('999')
    expect(clusterCountLabel(1000)).toBe('999+')
  })

  it('툴팁에는 최근 공시 5개까지 최근 순서로 보이고 나머지 건수를 센다', () => {
    const points = crowd([1, 2, 3, 4, 5, 6, 7])
    const { shown, rest } = clusterPreview({ points })
    expect(shown.map((p) => p.id)).toEqual(['a6', 'a5', 'a4', 'a3', 'a2'])
    expect(rest).toBe(2)
    expect(clusterPreview({ points: points.slice(0, 4) }).rest).toBe(0)
  })

  it('키보드 이동에서 모음 점은 대상 하나다', () => {
    const layout = layoutTimeline(
      rows,
      [{ id: 'first', row: 'A', date: '2026-02-01' }, ...crowd([10, 10, 10, 10]), { id: 'last', row: 'A', date: '2026-05-01' }],
      from,
      to,
      720,
    )
    const clusterId = layout.items[1].id
    expect(layout.items[1].kind).toBe('cluster')
    expect(nextItemId(layout.items, 'first', 'ArrowRight')).toBe(clusterId)
    expect(nextItemId(layout.items, clusterId, 'ArrowRight')).toBe('last')
    expect(nextItemId(layout.items, 'last', 'ArrowLeft')).toBe(clusterId)
  })
})

describe('키보드 이동', () => {
  const items = layoutTimeline(
    rows,
    [
      { id: 'a1', row: 'A', date: '2026-01-01' },
      { id: 'b1', row: 'B', date: '2026-01-05' },
      { id: 'a2', row: 'A', date: '2026-01-10' },
      { id: 'c1', row: 'C', date: '2026-01-09' },
    ],
    '2026-01-01',
    '2026-01-11',
  ).items

  it('좌우는 시간 순서로 하나씩, 끝에서는 멈춘다', () => {
    expect(nextItemId(items, 'a1', 'ArrowRight')).toBe('b1')
    expect(nextItemId(items, 'b1', 'ArrowLeft')).toBe('a1')
    expect(nextItemId(items, 'a1', 'ArrowLeft')).toBe('a1')
    expect(nextItemId(items, 'a2', 'ArrowRight')).toBe('a2')
  })

  it('Home·End는 가장 오래된 점과 가장 최근 점이다', () => {
    expect(nextItemId(items, 'b1', 'Home')).toBe('a1')
    expect(nextItemId(items, 'b1', 'End')).toBe('a2')
  })

  it('위아래는 이웃 줄에서 가로로 가장 가까운 점으로 가고, 끝 줄에서는 멈춘다', () => {
    expect(nextItemId(items, 'a2', 'ArrowDown')).toBe('b1')
    expect(nextItemId(items, 'b1', 'ArrowDown')).toBe('c1')
    expect(nextItemId(items, 'c1', 'ArrowUp')).toBe('b1')
    expect(nextItemId(items, 'a1', 'ArrowUp')).toBe('a1')
  })

  it('지금 점을 모르면 처음 점에서 출발하고, 점이 없으면 null이다', () => {
    expect(nextItemId(items, null, 'ArrowRight')).toBe('b1')
    expect(nextItemId([], null, 'End')).toBeNull()
  })
})

describe('툴팁', () => {
  it('왼쪽·오른쪽 끝 4분의 1에서는 한쪽으로 붙인다', () => {
    expect(tooltipAlign(10)).toBe('start')
    expect(tooltipAlign(50)).toBe('center')
    expect(tooltipAlign(90)).toBe('end')
  })

  it('hover·초점은 점과 보임을 함께 바꾸고, 떠나기는 점을 남긴 채 닫는다', () => {
    const shown = dotTimelineReducer(INITIAL_DOT_TIMELINE, { type: 'hover', id: 'a' })
    expect(shown).toEqual({ activeId: 'a', open: true, pinned: false })
    expect(dotTimelineReducer(shown, { type: 'hover', id: 'a' })).toBe(shown)
    expect(dotTimelineReducer(shown, { type: 'focus', id: 'a' })).toBe(shown)
    expect(dotTimelineReducer(shown, { type: 'focus', id: 'b' })).toEqual({ activeId: 'b', open: true, pinned: false })
    expect(dotTimelineReducer(shown, { type: 'leave' })).toEqual({ activeId: 'a', open: false, pinned: false })
    expect(dotTimelineReducer(INITIAL_DOT_TIMELINE, { type: 'leave' })).toBe(INITIAL_DOT_TIMELINE)
    expect(dotTimelineReducer(INITIAL_DOT_TIMELINE, { type: 'close' })).toBe(INITIAL_DOT_TIMELINE)
  })

  it('누르면 고정하고, 고정한 툴팁은 hover·떠나기에 바뀌지 않으며 다시 누르기·닫기로 닫는다', () => {
    const pinned = dotTimelineReducer(INITIAL_DOT_TIMELINE, { type: 'toggle-pin', id: 'c' })
    expect(pinned).toEqual({ activeId: 'c', open: true, pinned: true })
    expect(dotTimelineReducer(pinned, { type: 'hover', id: 'd' })).toBe(pinned)
    expect(dotTimelineReducer(pinned, { type: 'leave' })).toBe(pinned)
    expect(dotTimelineReducer(pinned, { type: 'focus', id: 'c' })).toBe(pinned)
    // 화살표로 다른 대상에 옮기면 고정을 풀고 그 대상의 툴팁을 보인다
    expect(dotTimelineReducer(pinned, { type: 'focus', id: 'd' })).toEqual({ activeId: 'd', open: true, pinned: false })
    expect(dotTimelineReducer(pinned, { type: 'toggle-pin', id: 'c' })).toEqual({ activeId: 'c', open: false, pinned: false })
    expect(dotTimelineReducer(pinned, { type: 'toggle-pin', id: 'd' })).toEqual({ activeId: 'd', open: true, pinned: true })
    expect(dotTimelineReducer(pinned, { type: 'close' })).toEqual({ activeId: 'c', open: false, pinned: false })
  })
})
