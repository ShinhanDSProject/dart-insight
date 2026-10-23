import { useCallback } from 'react'
import { searchCompanies, type Company } from '@/shared/api/companies'
import { useAsync } from '@/shared/hooks/useAsync'
import { validateSearchQuery } from '../model/searchQuery'

export interface SearchResult {
  query: string
  items: Company[]
}

/** 주소의 검색어(?q=)로 기업을 찾는다. 검색어가 맞지 않으면 부르지 않는다(idle) */
export function useCompanySearch(query: string) {
  const valid = validateSearchQuery(query) === null
  const load = useCallback(
    async (signal: AbortSignal): Promise<SearchResult> => {
      const trimmed = query.trim()
      const data = await searchCompanies(trimmed, signal)
      return { query: trimmed, items: data.items }
    },
    [query],
  )
  return useAsync(valid ? load : null)
}
