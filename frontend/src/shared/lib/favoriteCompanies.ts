/**
 * 관심 기업(FS-18). 보고서 선택 화면이 고정하고 검색 화면이 보여 주므로 shared에 둔다(DIR-4).
 * 브라우저(localStorage)에만 남기고 서버에는 보내지 않는다. 저장을 쓸 수 없으면 조용히 빈 목록으로 지낸다(AC4).
 */
import type { Company } from '@/shared/api/companies'

export const FAVORITE_COMPANIES_KEY = 'dart-insight:favorite-companies'
export const FAVORITE_COMPANIES_LIMIT = 12
/** 같은 탭 안에서 추가·빼기를 알리는 이벤트 이름(다른 탭은 storage 이벤트로 안다) */
export const FAVORITE_COMPANIES_CHANGE_EVENT = 'dart-insight:favorite-companies-change'

export interface FavoriteCompany {
  corpCode: string
  corpName: string
  stockCode: string | null
  listed: boolean
  /** 추가한 시각(ISO 8601) */
  addedAt: string
}

/** 저장할 수 있는 곳. 테스트에서는 가짜를 넘긴다 */
export type FavoriteStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function toFavoriteCompany(company: Company, addedAt: Date): FavoriteCompany {
  return {
    corpCode: company.corpCode,
    corpName: company.corpName,
    stockCode: company.stockCode,
    listed: company.listed,
    addedAt: addedAt.toISOString(),
  }
}

function isFavoriteCompanyEntry(value: unknown): value is FavoriteCompany {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.corpCode === 'string' &&
    v.corpCode !== '' &&
    typeof v.corpName === 'string' &&
    (typeof v.stockCode === 'string' || v.stockCode === null) &&
    typeof v.listed === 'boolean' &&
    typeof v.addedAt === 'string' &&
    !Number.isNaN(Date.parse(v.addedAt))
  )
}

/** 저장된 글자를 목록으로 읽는다. 깨진 값이면 빈 목록, 모양이 틀린 항목·중복은 버리고 12개까지만 둔다 */
export function parseFavoriteCompanies(raw: string | null): FavoriteCompany[] {
  if (raw === null) return []
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return []
  }
  if (!Array.isArray(parsed)) return []
  const seen = new Set<string>()
  const list: FavoriteCompany[] = []
  for (const item of parsed) {
    if (!isFavoriteCompanyEntry(item) || seen.has(item.corpCode)) continue
    seen.add(item.corpCode)
    list.push({
      corpCode: item.corpCode,
      corpName: item.corpName,
      stockCode: item.stockCode,
      listed: item.listed,
      addedAt: item.addedAt,
    })
  }
  return list.slice(0, FAVORITE_COMPANIES_LIMIT)
}

export function isFavoriteCompany(list: FavoriteCompany[], corpCode: string): boolean {
  return list.some((item) => item.corpCode === corpCode)
}

/** 맨 앞에 더한다. 같은 기업이 이미 있으면 빼고 맨 앞으로 옮기고, 12개를 넘으면 오래된 것을 버린다 */
export function addFavoriteCompany(list: FavoriteCompany[], entry: FavoriteCompany): FavoriteCompany[] {
  return [entry, ...list.filter((item) => item.corpCode !== entry.corpCode)].slice(0, FAVORITE_COMPANIES_LIMIT)
}

export function removeFavoriteCompany(list: FavoriteCompany[], corpCode: string): FavoriteCompany[] {
  return list.filter((item) => item.corpCode !== corpCode)
}

/** 관심 기업이면 빼고, 아니면 맨 앞에 더한다(별 버튼) */
export function toggleFavoriteCompany(list: FavoriteCompany[], company: Company, now: Date): FavoriteCompany[] {
  return isFavoriteCompany(list, company.corpCode)
    ? removeFavoriteCompany(list, company.corpCode)
    : addFavoriteCompany(list, toFavoriteCompany(company, now))
}

/** 저장된 글자를 그대로 읽는다. 저장소가 없거나 읽다가 예외가 나면 null(빈 목록) */
export function readFavoriteCompaniesRaw(storage: FavoriteStorage | null): string | null {
  if (storage === null) return null
  try {
    return storage.getItem(FAVORITE_COMPANIES_KEY)
  } catch {
    return null
  }
}

export function loadFavoriteCompanies(storage: FavoriteStorage | null): FavoriteCompany[] {
  return parseFavoriteCompanies(readFavoriteCompaniesRaw(storage))
}

/** 목록을 저장한다. 비었으면 지운다. 저장하지 못하면(용량·권한) 그냥 넘어간다 */
export function saveFavoriteCompanies(storage: FavoriteStorage | null, list: FavoriteCompany[]): void {
  if (storage === null) return
  try {
    if (list.length === 0) {
      storage.removeItem(FAVORITE_COMPANIES_KEY)
    } else {
      storage.setItem(FAVORITE_COMPANIES_KEY, JSON.stringify(list))
    }
  } catch {
    // 저장을 쓸 수 없는 브라우저에서는 관심 기업만 빠지고 나머지는 그대로 둔다(FS-18 AC4)
  }
}
