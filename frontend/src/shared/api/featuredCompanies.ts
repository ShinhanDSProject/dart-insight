import { apiGet } from './client'
import { endpoints } from './endpoints'

/** 첫 화면 대표 기업 한 곳(docs/api-spec.md, #399). 시가총액은 받지 않는다 */
export interface FeaturedCompany {
  rank: number
  corpCode: string
  corpName: string
  stockCode: string | null
}

export interface FeaturedCompanyListResponse {
  /** 시세 기준일(YYYY-MM-DD). 아직 받지 못했으면 null */
  baseDate: string | null
  /** 화면에 함께 보이는 출처(공공누리 출처표시) */
  source: string
  items: FeaturedCompany[]
}

export function getFeaturedCompanies(signal?: AbortSignal): Promise<FeaturedCompanyListResponse> {
  return apiGet(endpoints.featuredCompanies(), undefined, { signal })
}
