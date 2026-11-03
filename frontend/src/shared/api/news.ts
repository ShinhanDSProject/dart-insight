import { apiGet } from './client'
import { endpoints } from './endpoints'

/** 뉴스 한 건. 본문은 없고 원문 링크로만 보낸다(ADR-0046) */
export interface NewsArticle {
  title: string
  /** 요약 한두 줄. 없으면 빈 문자열 */
  description: string
  /** 언론사 원문. 없으면 네이버 뉴스 */
  url: string
  /** url의 도메인(예: example-news.co.kr). 읽지 못하면 null */
  source: string | null
  /** 한국 시간(YYYY-MM-DDTHH:mm:ss). 읽지 못하면 null */
  publishedAt: string | null
}

/** 기업 뉴스(docs/api-spec.md GET /api/companies/{corpCode}/news, #592) */
export interface CompanyNews {
  corpCode: string
  /** 네이버에 보낸 검색어(기업 이름) */
  query: string
  /** 네이버에서 받은 시각. 캐시된 응답이면 처음 받은 시각 */
  fetchedAt: string
  /** 최신순, 최대 10건 */
  items: NewsArticle[]
}

export function getCompanyNews(corpCode: string, signal?: AbortSignal): Promise<CompanyNews> {
  return apiGet(endpoints.companyNews(corpCode), undefined, { signal })
}
