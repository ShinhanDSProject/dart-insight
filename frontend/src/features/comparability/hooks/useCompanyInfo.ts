import { useCallback } from 'react'
import { match } from 'ts-pattern'
import { getCompany, type Company } from '@/shared/api/companies'
import { useAsync } from '@/shared/hooks/useAsync'

/** 탭 제목과 화면 부제에 쓸 기업 정보. 불러오는 중이거나 불러오지 못하면 null(화면 이름만 보인다) */
export function useCompanyInfo(corpCode: string): Company | null {
  const load = useCallback((signal: AbortSignal) => getCompany(corpCode, signal), [corpCode])
  const { state } = useAsync(load)
  return match(state)
    .with({ status: 'success' }, ({ data }) => data)
    .otherwise(() => null)
}
