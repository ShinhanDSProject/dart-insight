import { useCallback, useSyncExternalStore } from 'react'
import type { Company } from '@/shared/api/companies'
import {
  FAVORITE_COMPANIES_CHANGE_EVENT,
  FAVORITE_COMPANIES_KEY,
  isFavoriteCompany,
  loadFavoriteCompanies,
  parseFavoriteCompanies,
  readFavoriteCompaniesRaw,
  removeFavoriteCompany,
  saveFavoriteCompanies,
  toggleFavoriteCompany,
  type FavoriteCompany,
} from '@/shared/lib/favoriteCompanies'
import { browserStorage } from '@/shared/lib/recentAnalyses'

export interface FavoriteCompaniesController {
  /** 최근 추가 순(최대 12) */
  items: FavoriteCompany[]
  isFavorite: (corpCode: string) => boolean
  /** 관심 기업이면 빼고, 아니면 더한다 */
  toggle: (company: Company) => void
  remove: (corpCode: string) => void
}

// useSyncExternalStore는 같은 값이면 같은 참조를 받아야 다시 그리지 않으므로, 저장된 글자가 같으면 읽은 목록을 다시 쓴다
let cache: { raw: string | null; items: FavoriteCompany[] } = { raw: null, items: [] }

function getItems(): FavoriteCompany[] {
  const raw = readFavoriteCompaniesRaw(browserStorage())
  if (raw !== cache.raw) cache = { raw, items: parseFavoriteCompanies(raw) }
  return cache.items
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === FAVORITE_COMPANIES_KEY) onChange()
  }
  window.addEventListener(FAVORITE_COMPANIES_CHANGE_EVENT, onChange)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(FAVORITE_COMPANIES_CHANGE_EVENT, onChange)
    window.removeEventListener('storage', onStorage)
  }
}

/** 다른 탭에서 바뀌었을 수 있어 저장된 값을 다시 읽어 바꾸고, 같은 탭의 다른 곳에도 알린다 */
function update(change: (list: FavoriteCompany[]) => FavoriteCompany[]): void {
  const storage = browserStorage()
  saveFavoriteCompanies(storage, change(loadFavoriteCompanies(storage)))
  window.dispatchEvent(new Event(FAVORITE_COMPANIES_CHANGE_EVENT))
}

/**
 * 관심 기업 목록(FS-18). 보고서 선택 화면의 별 버튼, 검색 화면의 '관심 기업'과 검색 결과 별 표시가 같은 값을 본다.
 * 같은 탭의 다른 곳과 다른 탭에서 바꾼 것도 따라간다. 저장을 쓸 수 없으면 빈 목록으로 지낸다(AC4).
 */
export function useFavoriteCompanies(): FavoriteCompaniesController {
  const items = useSyncExternalStore(subscribe, getItems)
  const isFavorite = useCallback((corpCode: string) => isFavoriteCompany(items, corpCode), [items])
  const toggle = useCallback((company: Company) => update((list) => toggleFavoriteCompany(list, company, new Date())), [])
  const remove = useCallback((corpCode: string) => update((list) => removeFavoriteCompany(list, corpCode)), [])
  return { items, isFavorite, toggle, remove }
}
