import { apiDelete, apiGet, apiPut } from './client'
import type { Company } from './companies'
import { endpoints } from './endpoints'

/** 관심 기업 한 곳(docs/api-spec.md). 로그인한 회원만 쓴다 */
export interface FavoriteCompany extends Company {
  /** 추가한 시각(한국 시간, yyyy-MM-ddTHH:mm:ss) */
  addedAt: string
}

export interface FavoriteCompanyListResponse {
  items: FavoriteCompany[]
}

export function getFavoriteCompanies(): Promise<FavoriteCompanyListResponse> {
  return apiGet(endpoints.favoriteCompanies())
}

/** 이미 있으면 그대로 돌려준다. 12곳이 차 있으면 서버가 가장 오래된 기업을 뺀다 */
export function addFavoriteCompany(corpCode: string): Promise<FavoriteCompany> {
  return apiPut(endpoints.favoriteCompany(corpCode), undefined)
}

export function removeFavoriteCompany(corpCode: string): Promise<void> {
  return apiDelete(endpoints.favoriteCompany(corpCode))
}
