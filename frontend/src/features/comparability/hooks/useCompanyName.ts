import { useCallback } from 'react'
import { match } from 'ts-pattern'
import { getCompany } from '@/shared/api/companies'
import { useAsync } from '@/shared/hooks/useAsync'

/** 탭 제목에 쓸 회사명. 불러오는 중이거나 불러오지 못하면 null(화면 이름만 보인다) */
export function useCompanyName(corpCode: string): string | null {
  const load = useCallback((signal: AbortSignal) => getCompany(corpCode, signal), [corpCode])
  const { state } = useAsync(load)
  return match(state)
    .with({ status: 'success' }, ({ data }) => data.corpName)
    .otherwise(() => null)
}
