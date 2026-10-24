import { useEffect } from 'react'
import { validateSearchQuery } from '../model/searchQuery'

/** 입력을 멈추고 이만큼 지나면 검색한다 */
export const AUTO_SEARCH_DELAY_MS = 300

/**
 * 입력을 멈추면 Enter 없이 검색한다(#209). 검사를 통과한 검색어가 지금 주소의 검색어와 다를 때만 onSearch를 부른다.
 * 앞선 요청은 검색어가 바뀌면 useCompanySearch(useAsync)가 취소한다.
 */
export function useAutoSearch(input: string, query: string, onSearch: (next: string) => void) {
  useEffect(() => {
    const next = input.trim()
    if (validateSearchQuery(next) !== null || next === query.trim()) return
    const timer = window.setTimeout(() => onSearch(next), AUTO_SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [input, query, onSearch])
}
