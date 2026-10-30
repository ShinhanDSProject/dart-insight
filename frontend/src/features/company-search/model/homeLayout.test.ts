import { describe, expect, it } from 'vitest'
import type { FeaturedCompany } from '@/shared/api/featuredCompanies'
import {
  buildHomeTabs,
  defaultHomeTab,
  pickQuickFeatured,
  QUICK_FEATURED_LIMIT,
  resolveHomeTab,
  serializeHomeTab,
} from './homeLayout'

describe('첫 화면 보조 탐색 탭 구성(#538)', () => {
  it('비로그인·기록 없음 상태에서는 이번 시즌 변화와 대표 기업 두 탭만 두고 빈 탭을 만들지 않는다', () => {
    const tabs = buildHomeTabs({ hasRecent: false, hasFavorites: false })
    expect(tabs).toEqual([
      { value: 'season', label: '이번 시즌 변화' },
      { value: 'featured', label: '대표 기업' },
    ])
    expect(defaultHomeTab(tabs)).toBe('season')
  })

  it('최근 본 분석과 관심 기업이 있으면 개인화 탭을 앞에 둔다', () => {
    const tabs = buildHomeTabs({ hasRecent: true, hasFavorites: true })
    expect(tabs.map((t) => t.value)).toEqual(['recent', 'disclosures', 'season', 'featured'])
    expect(defaultHomeTab(tabs)).toBe('recent')
  })

  it('주소의 탭 값이 유효하면 유지하고, 목록에 없거나 비었으면 기본 탭으로 돌린다', () => {
    const tabs = buildHomeTabs({ hasRecent: false, hasFavorites: false })
    expect(resolveHomeTab('featured', tabs)).toBe('featured')
    expect(resolveHomeTab('disclosures', tabs)).toBe('season')
    expect(resolveHomeTab(null, tabs)).toBe('season')
  })

  it('기본 탭은 주소 쿼리를 비우고 다른 탭만 값으로 남긴다', () => {
    const tabs = buildHomeTabs({ hasRecent: true, hasFavorites: false })
    expect(serializeHomeTab('recent', tabs)).toBeNull()
    expect(serializeHomeTab('season', tabs)).toBe('season')
  })

  it('빠른 바로가기는 기준일·출처가 있을 때만 상위 최대 6곳을 추리고, 기준일이 없으면 숨긴다', () => {
    const items: FeaturedCompany[] = Array.from({ length: 10 }, (_, i) => ({
      rank: i + 1,
      corpCode: String(i + 1).padStart(8, '0'),
      corpName: `기업${i + 1}`,
      stockCode: `00000${i}`,
    }))
    const ready = pickQuickFeatured({ baseDate: '2026-10-24', source: '금융위원회, 공공데이터포털', items })
    expect(ready?.items).toHaveLength(QUICK_FEATURED_LIMIT)
    expect(ready?.items[0]?.corpName).toBe('기업1')
    expect(ready?.baseDate).toBe('2026-10-24')
    expect(ready?.source).toBe('금융위원회, 공공데이터포털')
    expect(pickQuickFeatured({ baseDate: null, source: '금융위원회, 공공데이터포털', items })).toBeNull()
    expect(pickQuickFeatured({ baseDate: '2026-10-24', source: '금융위원회, 공공데이터포털', items: [] })).toBeNull()
    expect(pickQuickFeatured(null)).toBeNull()
  })
})
