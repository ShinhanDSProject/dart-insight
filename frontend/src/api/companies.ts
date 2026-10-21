import { apiGet } from './client'

export interface Company {
  corpCode: string
  corpName: string
  stockCode: string | null
  listed: boolean
}

export function searchCompanies(query: string): Promise<{ items: Company[] }> {
  return apiGet('/api/companies', { query })
}

export function getCompany(corpCode: string): Promise<Company> {
  return apiGet(`/api/companies/${encodeURIComponent(corpCode)}`)
}
