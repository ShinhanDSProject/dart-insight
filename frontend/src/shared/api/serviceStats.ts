import { apiGet } from './client'
import { endpoints } from './endpoints'

/** docs/api-spec.md GET /api/stats(#866). 첫 화면 숫자 줄. 규모를 보이는 데만 쓴다 */
export interface ServiceStats {
  listedCompanies: number
  completedAnalyses: number
  textChanges: number
  countedAt: string
}

export function getServiceStats(signal?: AbortSignal): Promise<ServiceStats> {
  return apiGet(endpoints.stats(), undefined, { signal })
}
