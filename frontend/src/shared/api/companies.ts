import { apiGet } from './client'
import { endpoints } from './endpoints'

export interface Company {
  corpCode: string
  corpName: string
  stockCode: string | null
  listed: boolean
}

export function searchCompanies(query: string, signal?: AbortSignal): Promise<{ items: Company[] }> {
  return apiGet(endpoints.companies(), { query }, { signal })
}

export function getCompany(corpCode: string, signal?: AbortSignal): Promise<Company> {
  return apiGet(endpoints.company(corpCode), undefined, { signal })
}

/** OpenDART 법인구분(corp_cls). Y 유가증권시장, K 코스닥, N 코넥스, E 기타(docs/api-spec.md 공통 값) */
export type CorpClass = 'Y' | 'K' | 'N' | 'E'

/** 기업 개황(GET /api/companies/{corpCode}/overview). OpenDART company.json 값 그대로이고 없는 값은 null */
export interface CompanyOverview {
  corpCode: string
  /** OpenDART가 자료 없음(013)이면 false이고 개황 필드는 모두 null */
  available: boolean
  corpName: string | null
  corpNameEng: string | null
  stockName: string | null
  stockCode: string | null
  ceoName: string | null
  /** 법인구분(CorpClass). 모르는 값이 와도 그대로 둔다(화면은 원문을 보여 줌) */
  corpClass: string | null
  indutyCode: string | null
  /** 설립일(YYYY-MM-DD) */
  establishedDate: string | null
  /** 결산월(1~12) */
  accountingMonth: number | null
  /** 홈페이지 원문. http(s)://가 없을 수 있다 */
  homepageUrl: string | null
  irUrl: string | null
  address: string | null
  phoneNumber: string | null
  /** OpenDART에서 받은 시각(YYYY-MM-DDTHH:mm:ss) */
  fetchedAt: string
  /** 다시 받지 못해 저장된 값을 보여 줄 때 그 이유(에러 코드) */
  refreshError: string | null
}

export function getCompanyOverview(corpCode: string, signal?: AbortSignal): Promise<CompanyOverview> {
  return apiGet(endpoints.companyOverview(corpCode), undefined, { signal })
}
