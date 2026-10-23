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
