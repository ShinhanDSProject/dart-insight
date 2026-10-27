import { getFeaturedCompanies } from '@/shared/api/featuredCompanies'
import { useAsync } from '@/shared/hooks/useAsync'

/** 첫 화면 대표 기업(#399). 화면을 떠나면 요청을 취소한다 */
export function useFeaturedCompanies() {
  return useAsync(getFeaturedCompanies)
}
