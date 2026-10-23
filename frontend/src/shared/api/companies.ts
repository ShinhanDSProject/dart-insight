import { apiGet } from './client'
import { endpoints } from './endpoints'

export interface Company {
  corpCode: string
  corpName: string
  stockCode: string | null
  listed: boolean
}

export function searchCompanies(query: string): Promise<{ items: Company[] }> {
  return apiGet(endpoints.companies(), { query })
}

export function getCompany(corpCode: string): Promise<Company> {
  return apiGet(endpoints.company(corpCode))
}
