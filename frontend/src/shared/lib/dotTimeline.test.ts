import { describe, expect, it } from 'vitest'
import {
  dayNumber,
  dotTimelineReducer,
  INITIAL_DOT_TIMELINE,
  layoutTimeline,
  monthTicks,
  nextPointId,
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
    expect(layout.placed.map((p) => [p.point.id, p.rowIndex, p.x])).toEqual([
      ['a', 0, 10],
      ['c', 2, 10],
      ['new', 0, 80],
    ])
  })

  it('같은 줄에서 가까운 날의 점은 가운데 → 위 → 아래 자리로 비키고, 다 차면 가장 오래전에 쓴 자리를 다시 쓴다', () => {
    const layout = layoutTimeline(
      rows,
      ['p1', 'p2', 'p3', 'p4'].map((id) => ({ id, row: 'A', date: '2026-03-01' })).concat({ id: 'far', row: 'A', date: '2026-03-20' }),
      '2026-01-01',
      '2026-12-31',
    )
    expect(layout.placed.map((p) => [p.point.id, p.lane])).toEqual([
      ['p1', 0],
      ['p2', -1],
      ['p3', 1],
      ['p4', 0],
      ['far', 0],
    ])
  })
})

describe('키보드 이동', () => {
  const placed = layoutTimeline(
    rows,
    [
      { id: 'a1', row: 'A', date: '2026-01-01' },
      { id: 'b1', row: 'B', date: '2026-01-05' },
      { id: 'a2', row: 'A', date: '2026-01-10' },
      { id: 'c1', row: 'C', date: '2026-01-09' },
    ],
    '2026-01-01',
    '2026-01-11',
  ).placed

  it('좌우는 시간 순서로 하나씩, 끝에서는 멈춘다', () => {
    expect(nextPointId(placed, 'a1', 'ArrowRight')).toBe('b1')
    expect(nextPointId(placed, 'b1', 'ArrowLeft')).toBe('a1')
    expect(nextPointId(placed, 'a1', 'ArrowLeft')).toBe('a1')
    expect(nextPointId(placed, 'a2', 'ArrowRight')).toBe('a2')
  })

  it('Home·End는 가장 오래된 점과 가장 최근 점이다', () => {
    expect(nextPointId(placed, 'b1', 'Home')).toBe('a1')
    expect(nextPointId(placed, 'b1', 'End')).toBe('a2')
  })

  it('위아래는 이웃 줄에서 가로로 가장 가까운 점으로 가고, 끝 줄에서는 멈춘다', () => {
    expect(nextPointId(placed, 'a2', 'ArrowDown')).toBe('b1')
    expect(nextPointId(placed, 'b1', 'ArrowDown')).toBe('c1')
    expect(nextPointId(placed, 'c1', 'ArrowUp')).toBe('b1')
    expect(nextPointId(placed, 'a1', 'ArrowUp')).toBe('a1')
  })

  it('지금 점을 모르면 처음 점에서 출발하고, 점이 없으면 null이다', () => {
    expect(nextPointId(placed, null, 'ArrowRight')).toBe('b1')
    expect(nextPointId([], null, 'End')).toBeNull()
  })
})

describe('툴팁', () => {
  it('왼쪽·오른쪽 끝 4분의 1에서는 한쪽으로 붙인다', () => {
    expect(tooltipAlign(10)).toBe('start')
    expect(tooltipAlign(50)).toBe('center')
    expect(tooltipAlign(90)).toBe('end')
  })

  it('보이기는 점과 보임을 함께 바꾸고, 숨기기는 점을 남긴다', () => {
    const shown = dotTimelineReducer(INITIAL_DOT_TIMELINE, { type: 'show', id: 'a' })
    expect(shown).toEqual({ activeId: 'a', open: true })
    expect(dotTimelineReducer(shown, { type: 'show', id: 'a' })).toBe(shown)
    expect(dotTimelineReducer(shown, { type: 'hide' })).toEqual({ activeId: 'a', open: false })
    expect(dotTimelineReducer(INITIAL_DOT_TIMELINE, { type: 'hide' })).toBe(INITIAL_DOT_TIMELINE)
  })
})
