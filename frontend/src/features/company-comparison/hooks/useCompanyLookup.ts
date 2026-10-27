import { useCallback, useEffect, useState } from 'react'
import { searchCompanies } from '@/shared/api/companies'
import { useAsync } from '@/shared/hooks/useAsync'
import { isLookupQuery } from '../model/companyPicker'

/** 입력을 멈추고 이만큼 지나면 찾는다(첫 화면 검색과 같은 값) */
export const LOOKUP_DELAY_MS = 300

/** 기업 고르기 칸의 검색. 입력을 멈추면 찾고, 검색어가 바뀌면 앞선 요청을 취소한다(useAsync) */
export function useCompanyLookup(input: string) {
  const [query, setQuery] = useState('')
  useEffect(() => {
    const next = input.trim()
    const timer = window.setTimeout(() => setQuery(next), LOOKUP_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [input])
  const load = useCallback((signal: AbortSignal) => searchCompanies(query, signal), [query])
  return { query, ...useAsync(isLookupQuery(query) ? load : null) }
}
