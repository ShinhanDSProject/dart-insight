import { describe, expect, it } from 'vitest'
import type { DisclosureGroup, DisclosureItem } from '@/shared/api/disclosures'
import {
  compareWithReportPath,
  groupChips,
  INITIAL_TIMELINE,
  TIMELINE_PAGE_SIZE,
  timelineReducer,
  timelineView,
} from './disclosureTimeline'

function item(rceptNo: string, receivedDate: string, group: DisclosureGroup = 'OWNERSHIP'): DisclosureItem {
  return {
    rceptNo,
    reportName: '임원ㆍ주요주주특정증권등소유상황보고서',
    filerName: '홍길동',
    receivedDate,
    group,
    groupLabel: '지분 변동',
    periodic: false,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
    remarks: null,
    keyItemsKind: null,
  }
}

describe('공시 타임라인 상태', () => {
  it('묶음을 바꾸면 보여 주는 수를 처음으로 되돌린다', () => {
    const more = timelineReducer(INITIAL_TIMELINE, { type: 'show-more' })
    expect(more.limit).toBe(TIMELINE_PAGE_SIZE * 2)
    expect(timelineReducer(more, { type: 'select-group', group: 'FUNDING' })).toEqual({
      group: 'FUNDING',
      limit: TIMELINE_PAGE_SIZE,
    })
  })

  it('같은 묶음을 다시 고르면 상태를 그대로 둔다', () => {
    const more = timelineReducer(INITIAL_TIMELINE, { type: 'show-more' })
    expect(timelineReducer(more, { type: 'select-group', group: null })).toBe(more)
  })
})

describe('거르기 칩', () => {
  it('맨 앞에 전체 건수를 두고 서버 순서를 지킨다', () => {
    const chips = groupChips([
      { group: 'PERIODIC', label: '정기보고서', count: 1 },
      { group: 'OWNERSHIP', label: '지분 변동', count: 71 },
      { group: 'FUNDING', label: '자금 조달', count: 0 },
    ])
    expect(chips.map((c) => [c.group, c.label, c.count])).toEqual([
      [null, '전체', 72],
      ['PERIODIC', '정기보고서', 1],
      ['OWNERSHIP', '지분 변동', 71],
      ['FUNDING', '자금 조달', 0],
    ])
  })
})

describe('타임라인 보기', () => {
  const items = [
    item('20261026000001', '2026-10-26'),
    item('20261026000002', '2026-10-26', 'BUSINESS'),
    item('20261020000001', '2026-10-20'),
    item('20260814000001', '2026-08-14', 'PERIODIC'),
  ]

  it('접수일별로 묶고 서버 순서를 지킨다', () => {
    const view = timelineView(items, INITIAL_TIMELINE)
    expect(view.days.map((d) => [d.date, d.items.map((i) => i.rceptNo)])).toEqual([
      ['2026-10-26', ['20261026000001', '20261026000002']],
      ['2026-10-20', ['20261020000001']],
      ['2026-08-14', ['20260814000001']],
    ])
    expect(view.total).toBe(4)
    expect(view.remaining).toBe(0)
  })

  it('고른 묶음만 남긴다', () => {
    const view = timelineView(items, { group: 'OWNERSHIP', limit: TIMELINE_PAGE_SIZE })
    expect(view.days.flatMap((d) => d.items.map((i) => i.rceptNo))).toEqual(['20261026000001', '20261020000001'])
    expect(view.total).toBe(2)
  })

  it('보여 주는 수를 넘는 공시는 남은 수로 센다', () => {
    const view = timelineView(items, { group: null, limit: 3 })
    expect(view.days.flatMap((d) => d.items)).toHaveLength(3)
    expect(view.remaining).toBe(1)
  })

  it('맞는 공시가 없으면 빈 목록이다', () => {
    expect(timelineView(items, { group: 'FUNDING', limit: TIMELINE_PAGE_SIZE })).toEqual({
      days: [],
      total: 0,
      remaining: 0,
    })
  })
})

describe('이 보고서로 비교하기 주소', () => {
  it('기업 화면에 현재 보고서를 골라 연다', () => {
    expect(compareWithReportPath('00126380', '20260814001234')).toBe('/companies/00126380?current=20260814001234')
    expect(compareWithReportPath('a/b', '1')).toBe('/companies/a%2Fb?current=1')
  })
})
