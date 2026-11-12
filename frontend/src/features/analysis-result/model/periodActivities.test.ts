import { describe, expect, it } from 'vitest'
import type { ActivityImpact, ActivityItem } from '@/shared/api/activities'
import {
  audienceCount,
  holdReasonText,
  impactKindLabel,
  impactToneLabel,
  itemsFor,
  orderedImpacts,
  signalBadge,
  signalCounts,
  timelineSpan,
} from './periodActivities'

const evidence = {
  evidenceId: '20260814000001#B11',
  rceptNo: '20260814000001',
  blockNo: 11,
  side: 'CURRENT' as const,
  sectionPath: 'II. 사업의 내용',
  changeId: 7,
}

function item(no: number, overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    no,
    area: 'BUSINESS',
    audiences: ['INVESTOR'],
    title: `활동 ${no}`,
    summary: '요지',
    facts: [{ quote: '원문', evidence }],
    signal: 'HOLD',
    holdReason: 'NO_CRITERIA',
    signalKind: 'OTHER',
    signalKindName: '그 밖의 사건',
    signalChange: 'OTHER',
    signalChangeName: '그 밖의 변화',
    impacts: [],
    changeIds: [7],
    ...overrides,
  }
}

const impact = (kind: ActivityImpact['kind'], text: string, tone: ActivityImpact['tone'] = null): ActivityImpact => ({
  kind,
  tone,
  text,
  premises: [],
})

describe('periodActivities', () => {
  it('쓰임을 고르면 그 쓰임이 붙은 카드만 남기고 전체면 그대로 둔다', () => {
    const items = [item(1, { audiences: ['INVESTOR', 'CAREER'] }), item(2, { audiences: ['PARTNER'] })]

    expect(itemsFor(items, null)).toHaveLength(2)
    expect(itemsFor(items, 'CAREER').map((i) => i.no)).toEqual([1])
    expect(audienceCount(items, 'PARTNER')).toBe(1)
    expect(audienceCount(items, 'INVESTOR')).toBe(1)
  })

  it('영향 줄은 회사가 밝힌 것, AI 전망, 확인할 점 순서로 두고 같은 종류는 받은 순서를 지킨다', () => {
    const ordered = orderedImpacts([impact('CHECK', 'c'), impact('OUTLOOK', 'o1'), impact('DISCLOSED', 'd'), impact('OUTLOOK', 'o2')])

    expect(ordered.map((i) => i.text)).toEqual(['d', 'o1', 'o2', 'c'])
  })

  it('신호 배지는 색과 함께 글자·표식을 갖는다', () => {
    expect(signalBadge('POSITIVE')).toEqual({ label: '긍정 신호', tone: 'positive', mark: '▲' })
    expect(signalBadge('CAUTION')).toEqual({ label: '주의 신호', tone: 'attention', mark: '▼' })
    expect(signalBadge('HOLD').label).toBe('보류')
  })

  it('보류일 때만 사유 문장을 보인다', () => {
    expect(holdReasonText('HOLD', 'EVIDENCE_NOT_CONFIRMED')).toContain('확인하지 못해')
    expect(holdReasonText('POSITIVE', null)).toBeNull()
    expect(holdReasonText('HOLD', null)).toBeNull()
  })

  it('좋은 면·나쁜 면 표시는 AI 전망 줄에만 붙는다', () => {
    expect(impactToneLabel(impact('OUTLOOK', 'x', 'GOOD'))).toBe('좋은 면')
    expect(impactToneLabel(impact('OUTLOOK', 'x', 'BAD'))).toBe('부담이 될 수 있는 면')
    expect(impactToneLabel(impact('OUTLOOK', 'x'))).toBeNull()
    expect(impactToneLabel(impact('DISCLOSED', 'x', 'GOOD'))).toBeNull()
    expect(impactKindLabel('CHECK')).toBe('확인할 점')
  })

  it('타임라인 건수와 첫 날짜~마지막 날짜를 쓴다', () => {
    expect(timelineSpan(['2026-03-19', '2025-09-23', '2025-12-01'])).toBe('3건 · 2025.09.23 ~ 2026.03.19')
    expect(timelineSpan(['2025-09-23', '2025-09-23'])).toBe('2건 · 2025.09.23')
    expect(timelineSpan([])).toBe('0건')
  })

  it('신호마다 카드 수를 센다', () => {
    expect(signalCounts([item(1, { signal: 'POSITIVE' }), item(2, { signal: 'CAUTION' }), item(3)])).toEqual({
      POSITIVE: 1,
      CAUTION: 1,
      HOLD: 1,
    })
  })
})
