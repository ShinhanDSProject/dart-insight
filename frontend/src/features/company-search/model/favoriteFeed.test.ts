import { describe, expect, it } from 'vitest'
import type { DisclosureItem } from '@/shared/api/disclosures'
import {
  FEED_SEEN_AT_KEY,
  feedReducer,
  feedView,
  isFeedSeen,
  isNewDisclosure,
  kstDate,
  loadFeedSeenAt,
  mergeFeed,
  saveFeedSeenAt,
  type FeedStorage,
} from './favoriteFeed'

function item(rceptNo: string, receivedDate: string): DisclosureItem {
  return {
    rceptNo,
    reportName: `공시 ${rceptNo}`,
    filerName: null,
    receivedDate,
    group: 'OTHER',
    groupLabel: '기타',
    periodic: false,
    dartUrl: `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${rceptNo}`,
    remarks: null,
  }
}

const samsung = { corpCode: '00126380', corpName: '삼성전자' }
const hynix = { corpCode: '00164779', corpName: 'SK하이닉스' }

describe('mergeFeed', () => {
  it('여러 기업의 공시를 접수일 최신순, 같은 날이면 접수번호 큰 순으로 합치고 기업 이름을 붙인다', () => {
    const merged = mergeFeed(
      [
        { company: samsung, items: [item('20261020000001', '2026-10-20'), item('20261001000005', '2026-10-01')] },
        { company: hynix, items: [item('20261020000009', '2026-10-20'), item('20261010000001', '2026-10-10')] },
      ],
      null,
    )
    expect(merged.map((e) => e.rceptNo)).toEqual(['20261020000009', '20261020000001', '20261010000001', '20261001000005'])
    expect(merged[0].corpName).toBe('SK하이닉스')
    expect(merged[1].corpName).toBe('삼성전자')
  })

  it('같은 접수번호는 하나만 남긴다', () => {
    const shared = item('20261020000001', '2026-10-20')
    const merged = mergeFeed([{ company: samsung, items: [shared] }, { company: hynix, items: [shared] }], null)
    expect(merged).toHaveLength(1)
  })

  it('최대 limit건까지만 돌려준다', () => {
    const items = Array.from({ length: 30 }, (_, i) => item(`202610010000${String(i).padStart(2, '0')}`, '2026-10-01'))
    expect(mergeFeed([{ company: samsung, items }], null)).toHaveLength(20)
    expect(mergeFeed([{ company: samsung, items }], null, 5)).toHaveLength(5)
  })

  it('마지막으로 본 날보다 뒤에 접수된 공시만 새 공시다', () => {
    const merged = mergeFeed(
      [{ company: samsung, items: [item('20261021000001', '2026-10-21'), item('20261020000001', '2026-10-20')] }],
      '2026-10-20',
    )
    expect(merged.map((e) => e.isNew)).toEqual([true, false])
  })
})

describe('isNewDisclosure', () => {
  it('본 적이 없으면 새 공시로 표시하지 않는다', () => {
    expect(isNewDisclosure('2026-10-21', null)).toBe(false)
  })

  it('본 날과 같은 날 접수된 공시는 새 공시가 아니다', () => {
    expect(isNewDisclosure('2026-10-20', '2026-10-20')).toBe(false)
    expect(isNewDisclosure('2026-10-21', '2026-10-20')).toBe(true)
  })
})

describe('kstDate', () => {
  it('한국 시간 날짜를 돌려준다', () => {
    expect(kstDate(new Date('2026-10-25T15:30:00Z'))).toBe('2026-10-26')
    expect(kstDate(new Date('2026-10-25T14:59:00Z'))).toBe('2026-10-25')
  })
})

describe('본 날 저장', () => {
  function memory(initial: Record<string, string> = {}): FeedStorage & { data: Record<string, string> } {
    const data = { ...initial }
    return {
      data,
      getItem: (key) => data[key] ?? null,
      setItem: (key, value) => {
        data[key] = value
      },
    }
  }
  const broken: FeedStorage = {
    getItem: () => {
      throw new Error('denied')
    },
    setItem: () => {
      throw new Error('quota')
    },
  }

  it('저장한 날을 읽는다', () => {
    const storage = memory()
    saveFeedSeenAt(storage, '2026-10-26')
    expect(storage.data[FEED_SEEN_AT_KEY]).toBe('2026-10-26')
    expect(loadFeedSeenAt(storage)).toBe('2026-10-26')
  })

  it('없거나 날짜 모양이 아니면 null이다', () => {
    expect(loadFeedSeenAt(memory())).toBeNull()
    expect(loadFeedSeenAt(memory({ [FEED_SEEN_AT_KEY]: 'yesterday' }))).toBeNull()
    expect(loadFeedSeenAt(null)).toBeNull()
  })

  it('저장소가 예외를 던져도 읽기는 null, 쓰기는 조용히 넘어간다', () => {
    expect(loadFeedSeenAt(broken)).toBeNull()
    expect(() => saveFeedSeenAt(broken, '2026-10-26')).not.toThrow()
    expect(() => saveFeedSeenAt(null, '2026-10-26')).not.toThrow()
  })
})

describe('feedReducer', () => {
  it('start(reset)는 이전 결과를 버리고 고른 기업을 불러오는 중으로 둔다', () => {
    const state = feedReducer({ old: { status: 'error' } }, { type: 'start', corpCodes: ['a', 'b'], reset: true })
    expect(state).toEqual({ a: { status: 'loading' }, b: { status: 'loading' } })
  })

  it('다시 시도(reset 아님)는 고른 기업만 불러오는 중으로 바꾸고 나머지는 둔다', () => {
    const state = feedReducer(
      { a: { status: 'success', items: [] }, b: { status: 'error' } },
      { type: 'start', corpCodes: ['b'], reset: false },
    )
    expect(state).toEqual({ a: { status: 'success', items: [] }, b: { status: 'loading' } })
  })

  it('불러오는 중인 기업의 응답만 받는다', () => {
    const loading = feedReducer({}, { type: 'start', corpCodes: ['a'], reset: true })
    const done = feedReducer(loading, { type: 'resolve', corpCode: 'a', items: [] })
    expect(done.a).toEqual({ status: 'success', items: [] })
    expect(feedReducer(done, { type: 'reject', corpCode: 'a' })).toBe(done)
    expect(feedReducer(done, { type: 'resolve', corpCode: 'z', items: [] })).toBe(done)
  })
})

describe('feedView', () => {
  it('관심 기업이 없으면 idle이다', () => {
    expect(feedView([], {}, null)).toEqual({ status: 'idle' })
  })

  it('받은 기업이 없고 남은 기업이 있으면 loading이다(결과가 없는 기업도 불러오는 중으로 본다)', () => {
    expect(feedView([samsung, hynix], { [samsung.corpCode]: { status: 'error' } }, null)).toEqual({ status: 'loading' })
  })

  it('모든 기업이 실패하면 error와 실패한 기업을 돌려준다', () => {
    const view = feedView([samsung], { [samsung.corpCode]: { status: 'error' } }, null)
    expect(view).toEqual({ status: 'error', failed: [samsung] })
    expect(isFeedSeen(view)).toBe(false)
  })

  it('일부만 실패하면 받은 공시와 실패한 기업을 함께 돌려주고, 다 받았으면 본 것으로 친다', () => {
    const view = feedView(
      [samsung, hynix],
      { [samsung.corpCode]: { status: 'success', items: [item('20261020000001', '2026-10-20')] }, [hynix.corpCode]: { status: 'error' } },
      null,
    )
    expect(view.status).toBe('success')
    if (view.status !== 'success') return
    expect(view.items).toHaveLength(1)
    expect(view.failed).toEqual([hynix])
    expect(view.pending).toBe(0)
    expect(isFeedSeen(view)).toBe(true)
  })

  it('아직 받는 기업이 있으면 본 것으로 치지 않는다', () => {
    const view = feedView(
      [samsung, hynix],
      { [samsung.corpCode]: { status: 'success', items: [] }, [hynix.corpCode]: { status: 'loading' } },
      null,
    )
    expect(view).toMatchObject({ status: 'success', pending: 1 })
    expect(isFeedSeen(view)).toBe(false)
  })
})
