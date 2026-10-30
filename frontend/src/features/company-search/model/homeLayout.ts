import type { FeaturedCompany, FeaturedCompanyListResponse } from '@/shared/api/featuredCompanies'
import type { TabItem } from '@/shared/ui'

/**
 * 첫 화면(W-01 ①, 검색 전) 중앙 레이아웃과 보조 탐색 탭 규칙(#538).
 * 비로그인 빈 상자나 기록이 없는 빈 탭은 노출하지 않고, 내용이 있는 탭만 정돈해 보여 준다.
 */

export type HomeTab = 'recent' | 'disclosures' | 'season' | 'featured'

export type HomeModal = 'none' | 'guide' | 'notice'

/** 검색창 바로 아래 빠른 바로가기로 보여 줄 대표 기업 최대 수 */
export const QUICK_FEATURED_LIMIT = 6

export interface HomeTabContext {
  hasRecent: boolean
  hasFavorites: boolean
}

/** 현재 회원·기록 상태에 맞춰 실제 내용이 있는 탭만 순서대로 만든다 */
export function buildHomeTabs({ hasRecent, hasFavorites }: HomeTabContext): TabItem<HomeTab>[] {
  const tabs: TabItem<HomeTab>[] = []
  if (hasRecent) tabs.push({ value: 'recent', label: '최근 본 분석' })
  if (hasFavorites) tabs.push({ value: 'disclosures', label: '관심 기업 새 공시' })
  tabs.push({ value: 'season', label: '이번 시즌 변화' })
  tabs.push({ value: 'featured', label: '대표 기업' })
  return tabs
}

/** 기본 탭(목록의 첫 탭, 없으면 '이번 시즌 변화') */
export function defaultHomeTab(tabs: readonly TabItem<HomeTab>[]): HomeTab {
  return tabs[0]?.value ?? 'season'
}

/** 주소(?tab=)의 값이 현재 보이는 탭 목록에 있으면 쓰고, 없으면 기본 탭으로 돌린다 */
export function resolveHomeTab(rawTab: string | null, tabs: readonly TabItem<HomeTab>[]): HomeTab {
  const matched = tabs.find((tab) => tab.value === rawTab)
  return matched ? matched.value : defaultHomeTab(tabs)
}

/** 기본 탭이면 주소 쿼리를 비우고(null), 다른 탭을 골랐을 때만 남긴다 */
export function serializeHomeTab(tab: HomeTab, tabs: readonly TabItem<HomeTab>[]): string | null {
  return tab === defaultHomeTab(tabs) ? null : tab
}

export interface QuickFeatured {
  baseDate: string
  source: string
  items: FeaturedCompany[]
}

/** 검색창 아래 빠른 바로가기용 상위 대표 기업. 기준일·출처(공공누리 표시, ADR-0033)가 없거나 비었으면 null */
export function pickQuickFeatured(data: FeaturedCompanyListResponse | null): QuickFeatured | null {
  if (data === null || data.baseDate === null || data.items.length === 0) return null
  return {
    baseDate: data.baseDate,
    source: data.source,
    items: data.items.slice(0, QUICK_FEATURED_LIMIT),
  }
}
