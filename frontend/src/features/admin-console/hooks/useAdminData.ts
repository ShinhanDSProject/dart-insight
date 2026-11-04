import { useCallback } from 'react'
import {
  getAdminAnalyses,
  type AdminAnalysisItem,
  type AdminOverview,
  type AdminUserItem,
  type PageOf,
  getAdminOverview,
  getAdminUsers,
  type AdminAnalysesQuery,
  type AdminDays,
  type AdminUsersQuery,
} from '@/shared/api/admin'
import { useAsync, type Loader } from '@/shared/hooks/useAsync'

/** 관리자 콘솔 데이터(FS-72). 조건이 바뀌면 이전 요청을 취소하고 다시 부른다(ST-4·5) */

export function useAdminOverview(days: AdminDays) {
  const load = useCallback<Loader<AdminOverview>>((signal) => getAdminOverview(days, { signal }), [days])
  return useAsync(load)
}

export function useAdminAnalyses({ status, days, q, page }: AdminAnalysesQuery) {
  const load = useCallback<Loader<PageOf<AdminAnalysisItem>>>(
    (signal) => getAdminAnalyses({ status, days, q, page }, { signal }),
    [status, days, q, page],
  )
  return useAsync(load)
}

export function useAdminUsers({ role, q, page }: AdminUsersQuery) {
  const load = useCallback<Loader<PageOf<AdminUserItem>>>(
    (signal) => getAdminUsers({ role, q, page }, { signal }),
    [role, q, page],
  )
  return useAsync(load)
}
