import { describe, expect, it } from 'vitest'
import {
  buildHomeTabs,
  defaultHomeTab,
  resolveHomeTab,
  serializeHomeTab,
} from './homeLayout'

describe('첫 화면 보조 탐색 탭 구성(#538)', () => {
  it('비로그인·기록 없음 상태에서는 이번 시즌 변화와 대표 기업 두 탭만 두고 빈 탭을 만들지 않는다', () => {
    const tabs = buildHomeTabs({ hasFavorites: false })
    expect(tabs).toEqual([
      { value: 'season', label: '이번 시즌 변화' },
      { value: 'featured', label: '대표 기업' },
    ])
    expect(defaultHomeTab(tabs)).toBe('season')
  })

  it('관심 기업이 있으면 새 공시 탭을 앞에 두고, 최근 본 분석은 탭으로 두지 않는다(#560)', () => {
    const tabs = buildHomeTabs({ hasFavorites: true })
    expect(tabs.map((t) => t.value)).toEqual(['disclosures', 'season', 'featured'])
    expect(defaultHomeTab(tabs)).toBe('disclosures')
  })

  it('주소의 탭 값이 유효하면 유지하고, 목록에 없거나 비었으면 기본 탭으로 돌린다', () => {
    const tabs = buildHomeTabs({ hasFavorites: false })
    expect(resolveHomeTab('featured', tabs)).toBe('featured')
    expect(resolveHomeTab('disclosures', tabs)).toBe('season')
    expect(resolveHomeTab(null, tabs)).toBe('season')
  })

  it('기본 탭은 주소 쿼리를 비우고 다른 탭만 값으로 남긴다', () => {
    const tabs = buildHomeTabs({ hasFavorites: true })
    expect(serializeHomeTab('disclosures', tabs)).toBeNull()
    expect(serializeHomeTab('season', tabs)).toBe('season')
  })
})
